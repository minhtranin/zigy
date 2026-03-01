"""
Updates tauri.conf.json for Windows build:
- Sets bundled resources (exe, onnxruntime.dll, vc_redist.x64.exe)
- Writes nsis_hooks.nsi file and sets installerHooks to point to it

onnxruntime.dll uses assembly manifest loading (WinSxS), so simply copying
VCRUNTIME140.dll to the resources folder does NOT work. The VC++ Redistributable
must be properly installed into the system by running vc_redist.x64.exe.

Note: installerHooks must be a PATH to a .nsi file, not the NSIS code itself.
"""
import json
import os

src_tauri_dir = os.path.dirname(__file__)
config_path = os.path.join(src_tauri_dir, "tauri.conf.json")
hooks_path = os.path.join(src_tauri_dir, "nsis_hooks.nsi")

# Write the NSIS hook to a file (installerHooks expects a file path)
nsis_hook_content = (
    "!macro NSIS_HOOK_POSTINSTALL\n"
    "  ; Install VC++ Redistributable silently (required by onnxruntime.dll)\n"
    '  ExecWait \'"$INSTDIR\\resources\\vc_redist.x64.exe" /install /quiet /norestart\'\n'
    "!macroend\n"
)
with open(hooks_path, "w") as f:
    f.write(nsis_hook_content)
print("Wrote nsis_hooks.nsi:")
print(nsis_hook_content)

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

# installerHooks must be a path to a .nsi file relative to tauri.conf.json
config["bundle"]["windows"]["nsis"]["installerHooks"] = "nsis_hooks.nsi"

with open(config_path, "w") as f:
    json.dump(config, f, indent=2)
    f.write("\n")

print("Updated tauri.conf.json with Windows resources + NSIS VC++ Redist hook")
print("  resources:", config["bundle"]["resources"])
print("  installerHooks:", config["bundle"]["windows"]["nsis"]["installerHooks"])
