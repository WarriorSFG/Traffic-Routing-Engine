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

    # 3. Compile standalone CLI executable: traffic_solver.exe
    exe_target = root_dir / "traffic_solver.exe"
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
        print("[BUILD ERROR] Failed to compile traffic_solver.exe:")
        print(res_exe.stderr)
    else:
        print("[BUILD SUCCESS] Compiled traffic_solver.exe successfully!")

    # 4. Compile Pybind11 Python extension: qpso_engine.pyd
    pyd_target = out_dir / "qpso_engine.pyd"
    print(f"\n[BUILD] Compiling pybind11 module: {pyd_target} ...")
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
    res_pyd = subprocess.run(cmd_pyd, capture_output=True, text=True)
    if res_pyd.returncode != 0:
        print("[BUILD ERROR] Failed to compile qpso_engine.pyd:")
        print(res_pyd.stderr)
        raise RuntimeError("Pybind11 extension compilation failed.")
    else:
        print("[BUILD SUCCESS] Compiled qpso_engine.pyd successfully!")

    # Also copy to root directory or sys.path for convenient importing
    shutil.copy(pyd_target, root_dir / "qpso_engine.pyd")
    print(f"[BUILD] Copied module to {root_dir / 'qpso_engine.pyd'}")


if __name__ == "__main__":
    build()
