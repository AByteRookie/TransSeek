' TransSeek - start the local server silently (no console window)
' Double-click this file to start http://127.0.0.1:9177 in the background.
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "D:\DeepSeekH"
sh.Run "node bin\ds.js server --port 9177", 0, False
