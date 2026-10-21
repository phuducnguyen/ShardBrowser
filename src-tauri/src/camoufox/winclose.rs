//! Close a browser that runs as several processes, the way a person would: by asking its windows
//! to close. On Windows, Camoufox is started through a launcher process, and the window belongs to
//! the browser process behind it, so `taskkill` aimed at the started process finds no window (and
//! with `/T` it refuses, because child processes are still running). Posting `WM_CLOSE` to every
//! top-level window of the whole process tree reaches the right one and lets Firefox write its
//! cookies and session before it exits.

use std::collections::{HashMap, HashSet};

/// `root` and everything below it, given (pid, parent pid) pairs of the running processes.
pub fn descendants_of(root: u32, pairs: &[(u32, u32)]) -> HashSet<u32> {
    let mut children: HashMap<u32, Vec<u32>> = HashMap::new();
    for (pid, parent) in pairs {
        children.entry(*parent).or_default().push(*pid);
    }
    let mut seen = HashSet::from([root]);
    let mut stack = vec![root];
    while let Some(p) = stack.pop() {
        for c in children.get(&p).into_iter().flatten() {
            if seen.insert(*c) {
                stack.push(*c);
            }
        }
    }
    seen
}

#[cfg(windows)]
pub fn close_tree(root_pid: u32) -> usize {
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{EnumWindows, GetWindowThreadProcessId, PostMessageW, WM_CLOSE};

    let mut pairs: Vec<(u32, u32)> = Vec::new();
    // SAFETY: a plain Toolhelp snapshot; the entry is zeroed with its size set as the API requires,
    // and the handle is closed on every path.
    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snap != INVALID_HANDLE_VALUE {
            let mut e: PROCESSENTRY32W = std::mem::zeroed();
            e.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
            let mut ok = Process32FirstW(snap, &mut e);
            while ok != 0 {
                pairs.push((e.th32ProcessID, e.th32ParentProcessID));
                ok = Process32NextW(snap, &mut e);
            }
            CloseHandle(snap);
        }
    }
    let tree = descendants_of(root_pid, &pairs);

    struct Ctx {
        tree: HashSet<u32>,
        sent: usize,
    }
    unsafe extern "system" fn each(hwnd: windows_sys::Win32::Foundation::HWND, lparam: isize) -> i32 {
        // SAFETY: `lparam` is the address of the `Ctx` that `close_tree` keeps alive for the whole call.
        let ctx = &mut *(lparam as *mut Ctx);
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if ctx.tree.contains(&pid) && PostMessageW(hwnd, WM_CLOSE, 0, 0) != 0 {
            ctx.sent += 1;
        }
        1 // keep enumerating
    }
    let mut ctx = Ctx { tree, sent: 0 };
    // SAFETY: the callback only reads `ctx` and runs synchronously inside this call.
    unsafe {
        EnumWindows(Some(each), &mut ctx as *mut Ctx as isize);
    }
    ctx.sent
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_tree_below_a_root_is_found_and_nothing_else() {
        // 1 launcher -> 2 browser -> 3, 4 content; 5 is another profile's launcher -> 6.
        let pairs = [(1, 100), (2, 1), (3, 2), (4, 2), (5, 100), (6, 5)];
        let t = descendants_of(1, &pairs);
        assert_eq!(t, HashSet::from([1, 2, 3, 4]));
        assert!(!t.contains(&5) && !t.contains(&6), "another profile's browser must not be touched");
        assert_eq!(descendants_of(9, &pairs), HashSet::from([9]), "an unknown root is just itself");
    }

    #[test]
    fn a_process_that_lists_itself_as_its_parent_does_not_loop() {
        assert_eq!(descendants_of(1, &[(1, 1), (2, 1)]), HashSet::from([1, 2]));
    }
}
