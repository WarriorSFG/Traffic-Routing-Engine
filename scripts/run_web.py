"""Web Server Launcher for Traffic Routing Engine React Dashboard.
Run this script to launch the backend REST API and serve the React web application.
"""

import argparse
import os
import sys
from pathlib import Path

# Add project root and src to path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))
sys.path.insert(0, str(root_dir / "src"))

from traffic_routing.dashboard.server import run_server


def main():
    parser = argparse.ArgumentParser(description="Traffic Routing Engine Web App Server")
    parser.add_argument("--port", type=int, default=5000, help="Port to bind server (default: 5000)")
    parser.add_argument("--debug", action="store_true", help="Run server in debug mode")
    args = parser.parse_args()

    print("=" * 70)
    print("  [TRAFFIC ROUTING ENGINE] - QUANTUM-INSPIRED QPSO WEB DASHBOARD")
    print("=" * 70)
    print(f"Backend API listening at: http://127.0.0.1:{args.port}")
    dist_dir = root_dir / "frontend" / "dist"
    if dist_dir.exists():
        print(f"Serving built React Web App at: http://127.0.0.1:{args.port}/")
    else:
        print("Tip: Run `npm run dev` in frontend/ for live hot-reloading development,")
        print("     or run `npm run build` in frontend/ to serve the production app directly.")
    print("=" * 70)

    run_server(port=args.port, debug=args.debug)


if __name__ == "__main__":
    main()
