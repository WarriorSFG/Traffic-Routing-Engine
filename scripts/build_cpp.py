"""C++ Solvers Compilation Script.
Builds:
1. Pybind11 extension: qpso_engine.pyd (for high-speed Python calls)
2. Standalone binary: traffic_solver.exe (for native C++ CLI runs)
"""

import os
import shutil
import subprocess
import sys
import sysconfig
from pathlib import Path


def build():
    root_dir = Path(__file__).resolve().parent.parent
    cpp_dir = root_dir / "src" / "cpp"
    include_dir = cpp_dir / "include"
    src_dir = cpp_dir / "src"
    out_dir = root_dir / "src" / "traffic_routing" / "solvers"
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1. Locate g++
    gpp = shutil.which("g++")
    if not gpp:
        # Check standard MSYS2 UCRT64 path
        msys_gpp = Path("C:/msys64/ucrt64/bin/g++.exe")
        if msys_gpp.exists():
            gpp = str(msys_gpp)
        else:
            raise RuntimeError("g++ compiler not found in PATH or C:/msys64/ucrt64/bin.")
    print(f"[BUILD] Found C++ Compiler: {gpp}")

    # 2. Get Python and pybind11 include and lib paths
    import pybind11
    pybind11_inc = pybind11.get_include()
    python_inc = sysconfig.get_path("include")
    python_lib_dir = sysconfig.get_config_var("LIBDIR") or str(Path(sys.base_prefix) / "libs")
    python_version = f"python{sys.version_info.major}{sys.version_info.minor}"

    print(f"[BUILD] Python Include: {python_inc}")
    print(f"[BUILD] Pybind11 Include: {pybind11_inc}")
    print(f"[BUILD] Python Libs: {python_lib_dir} (lib: {python_version})")

    is_win = (sys.platform == "win32")

    # 3. Compile standalone CLI executable
    exe_name = "traffic_solver.exe" if is_win else "traffic_solver"
    exe_target = root_dir / exe_name
    print(f"\n[BUILD] Compiling standalone executable: {exe_target} ...")
    cmd_exe = [
        gpp,
        "-O3",
        "-std=c++20",
        "-fopenmp",
        f"-I{include_dir}",
        str(src_dir / "main.cpp"),
        "-o",
        str(exe_target)
    ]
    res_exe = subprocess.run(cmd_exe, capture_output=True, text=True)
    if res_exe.returncode != 0:
        print(f"[BUILD ERROR] Failed to compile {exe_name}:")
        print(res_exe.stderr)
    else:
        print(f"[BUILD SUCCESS] Compiled {exe_name} successfully!")

    # 4. Compile Pybind11 Python extension (.pyd on Windows, .so on Linux)
    ext_name = "qpso_engine.pyd" if is_win else "qpso_engine.so"
    pyd_target = out_dir / ext_name
    print(f"\n[BUILD] Compiling pybind11 module: {pyd_target} ...")

    # On Windows, if a running Python process has module loaded, rename it before overwriting
    if pyd_target.exists():
        temp_backup = out_dir / f"{ext_name}.{os.getpid()}.old"
        try:
            pyd_target.rename(temp_backup)
        except Exception:
            pass

    if is_win:
        cmd_pyd = [
            gpp,
            "-O3",
            "-shared",
            "-std=c++20",
            "-fopenmp",
            "-static",
            "-static-libgcc",
            "-static-libstdc++",
            f"-I{include_dir}",
            f"-I{python_inc}",
            f"-I{pybind11_inc}",
            str(src_dir / "bindings.cpp"),
            f"-L{python_lib_dir}",
            f"-l{python_version}",
            "-o",
            str(pyd_target)
        ]
    else:
        cmd_pyd = [
            gpp,
            "-O3",
            "-shared",
            "-fPIC",
            "-std=c++20",
            "-fopenmp",
            f"-I{include_dir}",
            f"-I{python_inc}",
            f"-I{pybind11_inc}",
            str(src_dir / "bindings.cpp"),
            "-o",
            str(pyd_target)
        ]

    res_pyd = subprocess.run(cmd_pyd, capture_output=True, text=True)
    if res_pyd.returncode != 0:
        print(f"[BUILD ERROR] Failed to compile {ext_name}:")
        print(res_pyd.stderr)
        raise RuntimeError("Pybind11 extension compilation failed.")
    else:
        print(f"[BUILD SUCCESS] Compiled {ext_name} successfully!")

    # Also copy to root directory for convenient importing
    root_pyd = root_dir / ext_name
    if root_pyd.exists():
        temp_root_backup = root_dir / f"{ext_name}.{os.getpid()}.old"
        try:
            root_pyd.rename(temp_root_backup)
        except Exception:
            pass

    try:
        shutil.copy(pyd_target, root_pyd)
        print(f"[BUILD] Copied module to {root_pyd}")
    except PermissionError:
        print(f"[BUILD WARNING] Could not overwrite root {ext_name} (locked by active process).")
        print(f"[BUILD SUCCESS] Using fresh binary at {pyd_target}")


if __name__ == "__main__":
    build()
