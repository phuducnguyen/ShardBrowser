//! CF5: a local SOCKS5 relay that logs in to the profile's real proxy.
//!
//! Firefox cannot present a user name and password to a SOCKS5 proxy, and asks for HTTP proxy
//! credentials with a dialog. So each Camoufox profile gets a relay on `127.0.0.1` (random port,
//! lives as long as the profile runs). Firefox talks to it as an ordinary SOCKS5 proxy without
//! login, with remote DNS so names are resolved by the real proxy, never on this computer. The
//! relay opens the connection to the real proxy (SOCKS5 with login, or HTTP `CONNECT` with
//! `Proxy-Authorization`) and copies bytes both ways. UDP is not relayed; Firefox falls back to TCP.
//!
//! Only this computer can reach it, but any program on it could, so it is kept for the length of one
//! launch and never written anywhere.

use crate::proxy::{ProxyEntry, ProxyKind};
use anyhow::{Context, Result};
use base64::Engine as _;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use std::time::Duration;
use tokio::io::{copy_bidirectional, AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::task::JoinHandle;
use tokio::time::timeout;

const UPSTREAM_TIMEOUT: Duration = Duration::from_secs(15);

/// Where the browser asked to go.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Target {
    Domain(String, u16),
    Ip(IpAddr, u16),
}

impl Target {
    fn host_port(&self) -> String {
        match self {
            Target::Domain(d, p) => format!("{d}:{p}"),
            Target::Ip(IpAddr::V6(ip), p) => format!("[{ip}]:{p}"),
            Target::Ip(ip, p) => format!("{ip}:{p}"),
        }
    }
}

/// A running relay. Dropping it stops listening and ends the connections it is carrying.
pub struct Relay {
    pub port: u16,
    task: JoinHandle<()>,
}

impl Drop for Relay {
    fn drop(&mut self) {
        self.task.abort();
    }
}

/// Listen on a free local port and forward every connection through `upstream`.
pub async fn start(upstream: ProxyEntry) -> Result<Relay> {
    anyhow::ensure!(
        !matches!(upstream.kind, ProxyKind::Https),
        "HTTPS proxies (a proxy you reach over TLS) are not supported for Camoufox yet; use an HTTP or SOCKS5 proxy"
    );
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.context("open the local relay")?;
    let port = listener.local_addr()?.port();
    let task = tokio::spawn(async move {
        loop {
            let Ok((client, _)) = listener.accept().await else { break };
            let up = upstream.clone();
            tokio::spawn(async move {
                if let Err(e) = serve_client(client, &up).await {
                    eprintln!("[camoufox relay] connection ended: {e:#}");
                }
            });
        }
    });
    Ok(Relay { port, task })
}

async fn serve_client(mut client: TcpStream, upstream: &ProxyEntry) -> Result<()> {
    let target = match accept_socks5(&mut client).await {
        Ok(t) => t,
        Err(e) => return Err(e),
    };
    match timeout(UPSTREAM_TIMEOUT, connect_via(upstream, &target)).await {
        Ok(Ok(mut up)) => {
            client.write_all(&[5, 0, 0, 1, 0, 0, 0, 0, 0, 0]).await?;
            let _ = copy_bidirectional(&mut client, &mut up).await;
            Ok(())
        }
        Ok(Err(e)) => {
            let _ = client.write_all(&[5, 5, 0, 1, 0, 0, 0, 0, 0, 0]).await; // connection refused
            Err(e.context(format!("reach {}", target.host_port())))
        }
        Err(_) => {
            let _ = client.write_all(&[5, 6, 0, 1, 0, 0, 0, 0, 0, 0]).await; // TTL expired
            anyhow::bail!("the proxy did not answer for {} within {UPSTREAM_TIMEOUT:?}", target.host_port())
        }
    }
}

/// The SOCKS5 server side: greeting without login, then one CONNECT request.
pub async fn accept_socks5<S: AsyncRead + AsyncWrite + Unpin>(s: &mut S) -> Result<Target> {
    let mut head = [0u8; 2];
    s.read_exact(&mut head).await?;
    anyhow::ensure!(head[0] == 5, "not a SOCKS5 client");
    let mut methods = vec![0u8; head[1] as usize];
    s.read_exact(&mut methods).await?;
    if !methods.contains(&0) {
        s.write_all(&[5, 0xFF]).await?;
        anyhow::bail!("the client wants a login the relay does not ask for");
    }
    s.write_all(&[5, 0]).await?;

    let mut req = [0u8; 4];
    s.read_exact(&mut req).await?;
    let (cmd, atyp) = (req[1], req[3]);
    let target_host: Result<Target> = async {
        Ok(match atyp {
            1 => {
                let mut b = [0u8; 4];
                s.read_exact(&mut b).await?;
                Target::Ip(IpAddr::V4(Ipv4Addr::from(b)), 0)
            }
            3 => {
                let mut l = [0u8; 1];
                s.read_exact(&mut l).await?;
                let mut d = vec![0u8; l[0] as usize];
                s.read_exact(&mut d).await?;
                Target::Domain(String::from_utf8(d).context("host name is not text")?, 0)
            }
            4 => {
                let mut b = [0u8; 16];
                s.read_exact(&mut b).await?;
                Target::Ip(IpAddr::V6(Ipv6Addr::from(b)), 0)
            }
            _ => anyhow::bail!("unknown address type {atyp}"),
        })
    }
    .await;
    let host = match target_host {
        Ok(h) => h,
        Err(e) => {
            let _ = s.write_all(&[5, 8, 0, 1, 0, 0, 0, 0, 0, 0]).await; // address type not supported
            return Err(e);
        }
    };
    let mut pb = [0u8; 2];
    s.read_exact(&mut pb).await?;
    let port = u16::from_be_bytes(pb);
    if cmd != 1 {
        s.write_all(&[5, 7, 0, 1, 0, 0, 0, 0, 0, 0]).await?; // command not supported (UDP ASSOCIATE, BIND)
        anyhow::bail!("only CONNECT is relayed (command {cmd} refused)");
    }
    Ok(match host {
        Target::Domain(d, _) => Target::Domain(d, port),
        Target::Ip(ip, _) => Target::Ip(ip, port),
    })
}

/// Open a tunnel to `target` through the real proxy.
pub async fn connect_via(up: &ProxyEntry, target: &Target) -> Result<TcpStream> {
    let mut s = TcpStream::connect((up.host.as_str(), up.port)).await.with_context(|| format!("connect to the proxy {}:{}", up.host, up.port))?;
    match up.kind {
        ProxyKind::Socks5 => socks5_connect(&mut s, up, target).await?,
        ProxyKind::Http => http_connect(&mut s, up, target).await?,
        ProxyKind::Https => anyhow::bail!("HTTPS proxies are not supported for Camoufox yet"),
    }
    Ok(s)
}

async fn socks5_connect<S: AsyncRead + AsyncWrite + Unpin>(s: &mut S, up: &ProxyEntry, t: &Target) -> Result<()> {
    let with_login = !up.username.is_empty();
    s.write_all(&[5, 1, if with_login { 2 } else { 0 }]).await?;
    let mut greet = [0u8; 2];
    s.read_exact(&mut greet).await?;
    anyhow::ensure!(greet[0] == 5 && greet[1] != 0xFF, "the proxy accepts none of the offered login methods");
    if greet[1] == 2 {
        anyhow::ensure!(with_login, "the proxy asks for a login and none is set");
        anyhow::ensure!(up.username.len() < 256 && up.password.len() < 256, "login too long for SOCKS5");
        let mut a = vec![1u8, up.username.len() as u8];
        a.extend_from_slice(up.username.as_bytes());
        a.push(up.password.len() as u8);
        a.extend_from_slice(up.password.as_bytes());
        s.write_all(&a).await?;
        let mut r = [0u8; 2];
        s.read_exact(&mut r).await?;
        anyhow::ensure!(r[1] == 0, "the proxy rejected the user name or password");
    }
    let mut req = vec![5u8, 1, 0];
    let port = match t {
        Target::Domain(d, p) => {
            anyhow::ensure!(d.len() < 256, "host name too long");
            req.push(3);
            req.push(d.len() as u8);
            req.extend_from_slice(d.as_bytes());
            *p
        }
        Target::Ip(IpAddr::V4(ip), p) => {
            req.push(1);
            req.extend_from_slice(&ip.octets());
            *p
        }
        Target::Ip(IpAddr::V6(ip), p) => {
            req.push(4);
            req.extend_from_slice(&ip.octets());
            *p
        }
    };
    req.extend_from_slice(&port.to_be_bytes());
    s.write_all(&req).await?;
    let mut rep = [0u8; 4];
    s.read_exact(&mut rep).await?;
    anyhow::ensure!(rep[1] == 0, "the proxy refused the connection (SOCKS5 reply {})", rep[1]);
    let skip = match rep[3] {
        1 => 4 + 2,
        4 => 16 + 2,
        3 => {
            let mut l = [0u8; 1];
            s.read_exact(&mut l).await?;
            l[0] as usize + 2
        }
        other => anyhow::bail!("the proxy sent an unknown address type {other}"),
    };
    let mut rest = vec![0u8; skip];
    s.read_exact(&mut rest).await?;
    Ok(())
}

async fn http_connect<S: AsyncRead + AsyncWrite + Unpin>(s: &mut S, up: &ProxyEntry, t: &Target) -> Result<()> {
    let hp = t.host_port();
    let mut req = format!("CONNECT {hp} HTTP/1.1\r\nHost: {hp}\r\nProxy-Connection: Keep-Alive\r\n");
    if !up.username.is_empty() || !up.password.is_empty() {
        let tok = base64::engine::general_purpose::STANDARD.encode(format!("{}:{}", up.username, up.password));
        req.push_str(&format!("Proxy-Authorization: Basic {tok}\r\n"));
    }
    req.push_str("\r\n");
    s.write_all(req.as_bytes()).await?;
    // Read the answer one byte at a time so not a byte of the tunnel is consumed with it.
    let mut head = Vec::with_capacity(256);
    let mut b = [0u8; 1];
    while !head.ends_with(b"\r\n\r\n") {
        anyhow::ensure!(head.len() < 8192, "the proxy's answer is too long");
        s.read_exact(&mut b).await?;
        head.push(b[0]);
    }
    let line = String::from_utf8_lossy(&head);
    let status = line.split_whitespace().nth(1).unwrap_or("");
    anyhow::ensure!(status == "200", "the proxy answered {}", line.lines().next().unwrap_or("nothing"));
    Ok(())
}

/// The local address of a running relay, for the browser's prefs.
pub fn local_addr(r: &Relay) -> SocketAddr {
    SocketAddr::from((Ipv4Addr::LOCALHOST, r.port))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    fn entry(kind: ProxyKind, port: u16, user: &str, pass: &str) -> ProxyEntry {
        ProxyEntry {
            id: String::new(), name: "t".into(), kind, host: "127.0.0.1".into(), port,
            username: user.into(), password: pass.into(), country: String::new(), notes: String::new(),
        }
    }

    /// Accepts connections and echoes every byte back.
    async fn echo_server() -> u16 {
        let l = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = l.local_addr().unwrap().port();
        tokio::spawn(async move {
            while let Ok((mut s, _)) = l.accept().await {
                tokio::spawn(async move {
                    let mut buf = [0u8; 1024];
                    while let Ok(n) = s.read(&mut buf).await {
                        if n == 0 || s.write_all(&buf[..n]).await.is_err() { break; }
                    }
                });
            }
        });
        port
    }

    /// An HTTP proxy that records the CONNECT head, answers `status`, and tunnels to the target when it is 200.
    async fn http_proxy(status: &'static str, seen: Arc<Mutex<Vec<String>>>) -> u16 {
        let l = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = l.local_addr().unwrap().port();
        tokio::spawn(async move {
            while let Ok((mut c, _)) = l.accept().await {
                let seen = seen.clone();
                tokio::spawn(async move {
                    let mut head = Vec::new();
                    let mut b = [0u8; 1];
                    while !head.ends_with(b"\r\n\r\n") {
                        if c.read_exact(&mut b).await.is_err() { return; }
                        head.push(b[0]);
                    }
                    let text = String::from_utf8_lossy(&head).to_string();
                    seen.lock().unwrap().push(text.clone());
                    let target = text.split_whitespace().nth(1).unwrap_or("").to_string();
                    if status.starts_with("200") {
                        if let Ok(mut o) = TcpStream::connect(&target).await {
                            c.write_all(b"HTTP/1.1 200 Connection established\r\n\r\n").await.unwrap();
                            let _ = copy_bidirectional(&mut c, &mut o).await;
                        } else {
                            // a made-up host such as example.test: answer and wait
                            c.write_all(b"HTTP/1.1 200 Connection established\r\n\r\n").await.unwrap();
                            let _ = c.read(&mut [0u8; 1]).await;
                        }
                    } else {
                        c.write_all(format!("HTTP/1.1 {status}\r\n\r\n").as_bytes()).await.unwrap();
                    }
                });
            }
        });
        port
    }

    /// A SOCKS5 proxy that demands user/pass `want`, records the requested target, and tunnels to it.
    async fn socks_proxy(want: (&'static str, &'static str), seen: Arc<Mutex<Vec<Target>>>) -> u16 {
        let l = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = l.local_addr().unwrap().port();
        tokio::spawn(async move {
            while let Ok((mut c, _)) = l.accept().await {
                let seen = seen.clone();
                tokio::spawn(async move {
                    let mut g = [0u8; 2];
                    c.read_exact(&mut g).await.unwrap();
                    let mut m = vec![0u8; g[1] as usize];
                    c.read_exact(&mut m).await.unwrap();
                    assert!(m.contains(&2), "the relay should offer user/pass");
                    c.write_all(&[5, 2]).await.unwrap();
                    let mut v = [0u8; 2];
                    c.read_exact(&mut v).await.unwrap();
                    let mut u = vec![0u8; v[1] as usize];
                    c.read_exact(&mut u).await.unwrap();
                    let mut pl = [0u8; 1];
                    c.read_exact(&mut pl).await.unwrap();
                    let mut pw = vec![0u8; pl[0] as usize];
                    c.read_exact(&mut pw).await.unwrap();
                    let ok = u == want.0.as_bytes() && pw == want.1.as_bytes();
                    c.write_all(&[1, if ok { 0 } else { 1 }]).await.unwrap();
                    if !ok { return; }
                    let t = accept_socks5_request_only(&mut c).await;
                    seen.lock().unwrap().push(t.clone());
                    let dest = match &t { Target::Domain(d, p) => format!("{d}:{p}"), Target::Ip(ip, p) => format!("{ip}:{p}") };
                    if let Ok(mut o) = TcpStream::connect(&dest).await {
                        c.write_all(&[5, 0, 0, 1, 0, 0, 0, 0, 0, 0]).await.unwrap();
                        let _ = copy_bidirectional(&mut c, &mut o).await;
                    } else {
                        c.write_all(&[5, 4, 0, 1, 0, 0, 0, 0, 0, 0]).await.unwrap();
                    }
                });
            }
        });
        port
    }

    /// The request half of a SOCKS5 exchange (greeting already done), as a mock proxy reads it.
    async fn accept_socks5_request_only(c: &mut TcpStream) -> Target {
        let mut req = [0u8; 4];
        c.read_exact(&mut req).await.unwrap();
        let host = match req[3] {
            1 => { let mut b = [0u8; 4]; c.read_exact(&mut b).await.unwrap(); Target::Ip(IpAddr::V4(Ipv4Addr::from(b)), 0) }
            3 => { let mut l = [0u8; 1]; c.read_exact(&mut l).await.unwrap(); let mut d = vec![0u8; l[0] as usize]; c.read_exact(&mut d).await.unwrap(); Target::Domain(String::from_utf8(d).unwrap(), 0) }
            _ => panic!("unexpected address type"),
        };
        let mut p = [0u8; 2];
        c.read_exact(&mut p).await.unwrap();
        let port = u16::from_be_bytes(p);
        match host { Target::Domain(d, _) => Target::Domain(d, port), Target::Ip(i, _) => Target::Ip(i, port) }
    }

    /// What Firefox does: SOCKS5 without login, CONNECT to a target; returns the stream and the reply code.
    async fn browser_connect(relay_port: u16, target: Target) -> (TcpStream, u8) {
        let mut s = TcpStream::connect(("127.0.0.1", relay_port)).await.unwrap();
        s.write_all(&[5, 1, 0]).await.unwrap();
        let mut g = [0u8; 2];
        s.read_exact(&mut g).await.unwrap();
        assert_eq!(g, [5, 0]);
        let mut req = vec![5u8, 1, 0];
        match &target {
            Target::Domain(d, p) => { req.extend([3, d.len() as u8]); req.extend(d.as_bytes()); req.extend(p.to_be_bytes()); }
            Target::Ip(IpAddr::V4(ip), p) => { req.push(1); req.extend(ip.octets()); req.extend(p.to_be_bytes()); }
            Target::Ip(IpAddr::V6(ip), p) => { req.push(4); req.extend(ip.octets()); req.extend(p.to_be_bytes()); }
        }
        s.write_all(&req).await.unwrap();
        let mut rep = [0u8; 10];
        s.read_exact(&mut rep).await.unwrap();
        (s, rep[1])
    }

    #[tokio::test]
    async fn a_browser_without_login_reaches_a_site_through_an_http_proxy_that_needs_one() {
        let echo = echo_server().await;
        let seen = Arc::new(Mutex::new(Vec::new()));
        let up = http_proxy("200", seen.clone()).await;
        let relay = start(entry(ProxyKind::Http, up, "bob", "p@ss")).await.unwrap();
        let (mut s, code) = browser_connect(relay.port, Target::Ip(IpAddr::V4(Ipv4Addr::LOCALHOST), echo)).await;
        assert_eq!(code, 0);
        s.write_all(b"ping").await.unwrap();
        let mut back = [0u8; 4];
        s.read_exact(&mut back).await.unwrap();
        assert_eq!(&back, b"ping");
        let head = seen.lock().unwrap()[0].clone();
        assert!(head.starts_with(&format!("CONNECT 127.0.0.1:{echo} HTTP/1.1")), "{head}");
        let tok = base64::engine::general_purpose::STANDARD.encode("bob:p@ss");
        assert!(head.contains(&format!("Proxy-Authorization: Basic {tok}")), "{head}");
    }

    #[tokio::test]
    async fn a_host_name_is_handed_to_the_proxy_unresolved() {
        let seen = Arc::new(Mutex::new(Vec::new()));
        let up = http_proxy("200", seen.clone()).await;
        let relay = start(entry(ProxyKind::Http, up, "", "")).await.unwrap();
        let (_s, code) = browser_connect(relay.port, Target::Domain("example.test".into(), 443)).await;
        assert_eq!(code, 0);
        let head = seen.lock().unwrap()[0].clone();
        assert!(head.starts_with("CONNECT example.test:443 HTTP/1.1"), "name must reach the proxy, not be resolved here: {head}");
        assert!(!head.contains("Proxy-Authorization"), "no login, no header: {head}");
    }

    #[tokio::test]
    async fn a_socks5_proxy_with_login_is_logged_in_to() {
        let echo = echo_server().await;
        let seen = Arc::new(Mutex::new(Vec::new()));
        let up = socks_proxy(("alice", "s3cret"), seen.clone()).await;
        let relay = start(entry(ProxyKind::Socks5, up, "alice", "s3cret")).await.unwrap();
        let (mut s, code) = browser_connect(relay.port, Target::Ip(IpAddr::V4(Ipv4Addr::LOCALHOST), echo)).await;
        assert_eq!(code, 0);
        s.write_all(b"hello").await.unwrap();
        let mut back = [0u8; 5];
        s.read_exact(&mut back).await.unwrap();
        assert_eq!(&back, b"hello");
        assert_eq!(seen.lock().unwrap()[0], Target::Ip(IpAddr::V4(Ipv4Addr::LOCALHOST), echo));
    }

    #[tokio::test]
    async fn a_wrong_password_ends_in_a_refusal_the_browser_can_read() {
        let seen = Arc::new(Mutex::new(Vec::new()));
        let up = socks_proxy(("alice", "right"), seen).await;
        let relay = start(entry(ProxyKind::Socks5, up, "alice", "wrong")).await.unwrap();
        let (_s, code) = browser_connect(relay.port, Target::Domain("example.test".into(), 80)).await;
        assert_ne!(code, 0, "a failed login must not look like a working connection");
    }

    #[tokio::test]
    async fn a_proxy_that_answers_407_is_a_refusal() {
        let up = http_proxy("407 Proxy Authentication Required", Arc::new(Mutex::new(Vec::new()))).await;
        let relay = start(entry(ProxyKind::Http, up, "x", "y")).await.unwrap();
        let (_s, code) = browser_connect(relay.port, Target::Domain("example.test".into(), 80)).await;
        assert_eq!(code, 5);
    }

    #[tokio::test]
    async fn udp_associate_is_refused_so_the_browser_falls_back_to_tcp() {
        let relay = start(entry(ProxyKind::Http, 1, "", "")).await.unwrap();
        let mut s = TcpStream::connect(("127.0.0.1", relay.port)).await.unwrap();
        s.write_all(&[5, 1, 0]).await.unwrap();
        let mut g = [0u8; 2];
        s.read_exact(&mut g).await.unwrap();
        s.write_all(&[5, 3, 0, 1, 0, 0, 0, 0, 0, 0]).await.unwrap(); // UDP ASSOCIATE
        let mut rep = [0u8; 10];
        s.read_exact(&mut rep).await.unwrap();
        assert_eq!(rep[1], 7);
    }

    #[tokio::test]
    async fn the_relay_listens_on_localhost_only_and_stops_when_dropped() {
        let relay = start(entry(ProxyKind::Http, 1, "", "")).await.unwrap();
        assert!(local_addr(&relay).ip().is_loopback());
        let port = relay.port;
        drop(relay);
        tokio::time::sleep(Duration::from_millis(100)).await;
        assert!(TcpStream::connect(("127.0.0.1", port)).await.is_err(), "the port should be closed after the relay is dropped");
    }

    #[tokio::test]
    async fn an_https_proxy_is_refused_up_front() {
        let err = start(entry(ProxyKind::Https, 1, "", "")).await.err().expect("refused");
        assert!(err.to_string().contains("HTTPS"), "{err}");
    }
}
