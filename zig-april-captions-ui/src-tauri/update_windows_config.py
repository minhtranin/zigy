"""
Updates tauri.conf.json for Windows build:
- Sets bundled resources (exe, onnxruntime.dll, vc_redist.x64.exe)
- Adds NSIS postinstall hook to silently install VC++ Redistributable

onnxruntime.dll uses assembly manifest loading (WinSxS), so simply copying
VCRUNTIME140.dll to the resources folder does NOT work. The VC++ Redistributable
must be properly installed into the system by running vc_redist.x64.exe.
"""
import json
import os

config_path = os.path.join(os.path.dirname(__file__), "tauri.conf.json")

with open(config_path, "r") as f:
    config = json.load(f)

config["bundle"]["resources"] = [
    "resources/zig-april-captions.exe",
    "resources/onnxruntime.dll",
    "resources/vc_redist.x64.exe",
]

if "windows" not in config["bundle"]:
    config["bundle"]["windows"] = {}
if "nsis" not in config["bundle"]["windows"]:
    config["bundle"]["windows"]["nsis"] = {}

# NSIS_HOOK_POSTINSTALL runs after all files are installed to $INSTDIR.
# Runs vc_redist.x64.exe silently so onnxruntime.dll can find VCRUNTIME140.dll.
config["bundle"]["windows"]["nsis"]["installerHooks"] = (
    "!macro NSIS_HOOK_POSTINSTALL\n"
    "  ; Install VC++ Redistributable silently (required by onnxruntime.dll)\n"
    '  ExecWait \'"$INSTDIR\\resources\\vc_redist.x64.exe" /install /quiet /norestart\'\n'
    "!macroend"
)

with open(config_path, "w") as f:
    json.dump(config, f, indent=2)
    f.write("\n")

print("Updated tauri.conf.json with Windows resources + NSIS VC++ Redist hook")
print("  resources:", config["bundle"]["resources"])
print("  installerHooks:", repr(config["bundle"]["windows"]["nsis"]["installerHooks"]))
