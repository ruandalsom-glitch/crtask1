using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Media;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace CRTaskDesktop
{
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            string appDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CRTaskApp");
            string installedExePath = Path.Combine(appDataFolder, "CR-Task-Desktop.exe");
            string currentExe = Application.ExecutablePath;

            // If running from Downloads/Project (not the installed path), stop any older running instance so we upgrade cleanly
            if (!string.Equals(Path.GetFullPath(currentExe), Path.GetFullPath(installedExePath), StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    int currentPid = Process.GetCurrentProcess().Id;
                    foreach (Process p in Process.GetProcessesByName("CR-Task-Desktop"))
                    {
                        if (p.Id != currentPid)
                        {
                            try { p.Kill(); p.WaitForExit(2000); } catch { }
                        }
                    }
                }
                catch { }
            }

            bool createdNew;
            using (Mutex mutex = new Mutex(true, "CRTaskDesktopAppMutex_v2", out createdNew))
            {
                if (!createdNew)
                {
                    try
                    {
                        EventWaitHandle showEvent = EventWaitHandle.OpenExisting("CRTaskDesktopShowEvent_v2");
                        showEvent.Set();
                    }
                    catch { }
                    return;
                }

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new TrayApplicationContext());
            }
        }
    }

    public class TrayApplicationContext : ApplicationContext
    {
        // Win32 APIs
        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
        private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

        [DllImport("user32.dll")]
        private static extern bool IsWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool IsIconic(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll", EntryPoint = "SetClassLongPtr")]
        private static extern IntPtr SetClassLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

        [DllImport("user32.dll", EntryPoint = "SetClassLong")]
        private static extern uint SetClassLong32(IntPtr hWnd, int nIndex, uint dwNewLong);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool UnhookWindowsHookEx(IntPtr hhk);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr GetModuleHandle(string lpModuleName);

        [DllImport("user32.dll")]
        private static extern short GetAsyncKeyState(int vKey);

        [DllImport("user32.dll")]
        private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

        [DllImport("gdi32.dll")]
        private static extern IntPtr CreateRoundRectRgn(int x1, int y1, int x2, int y2, int cx, int cy);

        private const int SW_HIDE = 0;
        private const int SW_SHOWNORMAL = 1;
        private const int SW_RESTORE = 9;
        private const uint WM_CLOSE = 0x0010;
        private const uint WM_SETICON = 0x0080;
        private const int ICON_SMALL = 0;
        private const int ICON_BIG = 1;
        private const int GCLP_HICON = -14;
        private const int GCLP_HICONSM = -34;

        private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
        private static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
        private const uint SWP_NOMOVE = 0x0002;
        private const uint SWP_NOSIZE = 0x0001;
        private const uint SWP_SHOWWINDOW = 0x0040;

        private const int WH_KEYBOARD_LL = 13;
        private const int WM_KEYDOWN = 0x0100;
        private const int VK_CONTROL = 0x11;
        private const byte VK_V = 0x56;
        private const uint KEYEVENTF_KEYUP = 0x0002;

        private const string APP_URL = "https://crtask1.vercel.app/mensagens";
        private const string RUN_REGISTRY_KEY = @"Software\Microsoft\Windows\CurrentVersion\Run";
        private const string RUN_VALUE_NAME = "CRTaskDesktop";

        private NotifyIcon trayIcon;
        private Icon appIcon;
        private Image logoPngImage;
        private System.Windows.Forms.Timer monitorTimer;
        private System.Windows.Forms.Timer pasteCaptionTimer;
        private System.Windows.Forms.Timer restoreClipboardTimer;
        private EventWaitHandle showEvent;
        private IntPtr appHwnd = IntPtr.Zero;
        private IntPtr lastIconAppliedHwnd = IntPtr.Zero;
        private bool isExiting = false;
        private string lastAlarmTitle = "";
        private DateTime lastLaunchAttempt = DateTime.MinValue;
        private bool launchHiddenNext = false;

        // WhatsApp Auto-Caption State
        private ClipboardWatcherForm clipboardForm;
        private IntPtr keyboardHookId = IntPtr.Zero;
        private LowLevelKeyboardProc keyboardProcDelegate;
        private string pendingCaption = "";
        private DateTime pendingCaptionTime = DateTime.MinValue;
        private Image pendingImage = null;
        private bool hasPendingImageAndCaption = false;
        private bool isInternalClipboardChange = false;
        private bool isSimulatingPaste = false;

        private Form activeAlarmToast = null;

        private string appDataFolder;
        private string installedExePath;
        private string installedIconPath;
        private string profileFolder;
        private ToolStripMenuItem startupMenuItem;
        private ToolStripMenuItem autoCaptionMenuItem;
        private bool autoCaptionEnabled = true;

        public TrayApplicationContext()
        {
            appDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CRTaskApp");
            installedExePath = Path.Combine(appDataFolder, "CR-Task-Desktop.exe");
            installedIconPath = Path.Combine(appDataFolder, "cr-task.ico");
            profileFolder = Path.Combine(appDataFolder, "Profile");

            EnsureInstalledAndShortcut();

            appIcon = LoadEmbeddedIcon();
            logoPngImage = LoadEmbeddedLogoPng();

            ContextMenuStrip menu = new ContextMenuStrip();

            ToolStripMenuItem openItem = new ToolStripMenuItem("Abrir CR Task");
            openItem.Font = new Font(openItem.Font, FontStyle.Bold);
            openItem.Click += (s, e) => RestoreOrLaunchApp();
            menu.Items.Add(openItem);

            ToolStripMenuItem hideItem = new ToolStripMenuItem("Minimizar para a Bandeja (^)");
            hideItem.Click += (s, e) => HideAppToTray();
            menu.Items.Add(hideItem);

            menu.Items.Add(new ToolStripSeparator());

            autoCaptionMenuItem = new ToolStripMenuItem("Auto-Legenda WhatsApp (Ctrl+V Imagem + Texto)");
            autoCaptionMenuItem.Checked = autoCaptionEnabled;
            autoCaptionMenuItem.Click += (s, e) =>
            {
                autoCaptionEnabled = !autoCaptionEnabled;
                autoCaptionMenuItem.Checked = autoCaptionEnabled;
            };
            menu.Items.Add(autoCaptionMenuItem);

            startupMenuItem = new ToolStripMenuItem("Iniciar junto com o Windows");
            startupMenuItem.Checked = IsStartupEnabled();
            startupMenuItem.Click += (s, e) => ToggleStartup();
            menu.Items.Add(startupMenuItem);

            ToolStripMenuItem shortcutItem = new ToolStripMenuItem("Criar Atalho na Área de Trabalho");
            shortcutItem.Click += (s, e) =>
            {
                CreateDesktopShortcut();
                ShowNativeAlarmCard("Atalho 'CR Task' criado na Área de Trabalho com sucesso!", "ATALHO CRIADO • CR TASK");
            };
            menu.Items.Add(shortcutItem);

            menu.Items.Add(new ToolStripSeparator());

            ToolStripMenuItem exitItem = new ToolStripMenuItem("Sair Completamente");
            exitItem.Click += (s, e) => ExitApplication();
            menu.Items.Add(exitItem);

            trayIcon = new NotifyIcon
            {
                Icon = appIcon,
                Text = "CR Task • Ativo (Alarmes + Auto-Legenda WhatsApp)",
                ContextMenuStrip = menu,
                Visible = true
            };

            trayIcon.MouseClick += (s, e) =>
            {
                if (e.Button == MouseButtons.Left)
                {
                    RestoreOrLaunchApp();
                }
            };
            trayIcon.DoubleClick += (s, e) => RestoreOrLaunchApp();

            showEvent = new EventWaitHandle(false, EventResetMode.AutoReset, "CRTaskDesktopShowEvent_v2");

            // Initialize Clipboard Listener & Keyboard Hook for WhatsApp Auto-Caption
            clipboardForm = new ClipboardWatcherForm(OnClipboardChanged);
            keyboardProcDelegate = HookCallback;
            using (Process curProcess = Process.GetCurrentProcess())
            using (ProcessModule curModule = curProcess.MainModule)
            {
                keyboardHookId = SetWindowsHookEx(WH_KEYBOARD_LL, keyboardProcDelegate, GetModuleHandle(curModule.ModuleName), 0);
            }

            pasteCaptionTimer = new System.Windows.Forms.Timer();
            pasteCaptionTimer.Interval = 750;
            pasteCaptionTimer.Tick += PasteCaptionTimer_Tick;

            restoreClipboardTimer = new System.Windows.Forms.Timer();
            restoreClipboardTimer.Interval = 350;
            restoreClipboardTimer.Tick += RestoreClipboardTimer_Tick;

            LaunchBrowserApp();

            monitorTimer = new System.Windows.Forms.Timer();
            monitorTimer.Interval = 250;
            monitorTimer.Tick += MonitorTimer_Tick;
            monitorTimer.Start();
        }

        private void OnClipboardChanged()
        {
            if (isInternalClipboardChange) return;

            try
            {
                IntPtr fg = GetForegroundWindow();
                string fgTitle = GetWindowTitle(fg);
                bool isFromCRTask = fgTitle.IndexOf("CR Task", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                    fgTitle.IndexOf("CR Admin Workspace", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                    fgTitle.IndexOf("crtask", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                    (fg == appHwnd && appHwnd != IntPtr.Zero);

                bool hasImg = Clipboard.ContainsImage();
                bool hasTxt = Clipboard.ContainsText();

                if (hasTxt && !hasImg)
                {
                    string txt = (Clipboard.GetText() ?? "").Trim();
                    if (!string.IsNullOrEmpty(txt) && !txt.StartsWith("http", StringComparison.OrdinalIgnoreCase) && isFromCRTask)
                    {
                        pendingCaption = txt;
                        pendingCaptionTime = DateTime.Now;
                        hasPendingImageAndCaption = false;
                    }
                }
                else if (hasImg)
                {
                    if (hasTxt)
                    {
                        string txt = (Clipboard.GetText() ?? "").Trim();
                        if (!string.IsNullOrEmpty(txt))
                        {
                            pendingCaption = txt;
                            pendingCaptionTime = DateTime.Now;
                        }
                    }

                    if (!string.IsNullOrEmpty(pendingCaption) && (DateTime.Now - pendingCaptionTime).TotalSeconds < 10)
                    {
                        pendingImage = Clipboard.GetImage();
                        hasPendingImageAndCaption = true;
                        pendingCaptionTime = DateTime.Now;
                    }
                    else if (!isFromCRTask)
                    {
                        hasPendingImageAndCaption = false;
                    }
                }
            }
            catch { }
        }

        private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0 && wParam == (IntPtr)WM_KEYDOWN && autoCaptionEnabled && !isSimulatingPaste)
            {
                int vkCode = Marshal.ReadInt32(lParam);
                if (vkCode == VK_V)
                {
                    bool ctrlDown = (GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0;
                    if (ctrlDown && hasPendingImageAndCaption && !string.IsNullOrEmpty(pendingCaption))
                    {
                        if ((DateTime.Now - pendingCaptionTime).TotalMinutes < 30)
                        {
                            IntPtr fg = GetForegroundWindow();
                            string fgTitle = GetWindowTitle(fg);
                            if (fgTitle.IndexOf("WhatsApp", StringComparison.OrdinalIgnoreCase) >= 0)
                            {
                                pasteCaptionTimer.Stop();
                                pasteCaptionTimer.Start();
                            }
                        }
                    }
                }
            }
            return CallNextHookEx(keyboardHookId, nCode, wParam, lParam);
        }

        private void PasteCaptionTimer_Tick(object sender, EventArgs e)
        {
            pasteCaptionTimer.Stop();
            if (string.IsNullOrEmpty(pendingCaption)) return;

            try
            {
                isInternalClipboardChange = true;
                isSimulatingPaste = true;

                if (pendingImage == null && Clipboard.ContainsImage())
                {
                    pendingImage = Clipboard.GetImage();
                }

                Clipboard.SetText(pendingCaption);

                keybd_event((byte)VK_CONTROL, 0, 0, UIntPtr.Zero);
                keybd_event(VK_V, 0, 0, UIntPtr.Zero);
                keybd_event(VK_V, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                keybd_event((byte)VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

                restoreClipboardTimer.Stop();
                restoreClipboardTimer.Start();
            }
            catch
            {
                isInternalClipboardChange = false;
                isSimulatingPaste = false;
            }
        }

        private void RestoreClipboardTimer_Tick(object sender, EventArgs e)
        {
            restoreClipboardTimer.Stop();
            try
            {
                if (pendingImage != null)
                {
                    DataObject data = new DataObject();
                    data.SetImage(pendingImage);
                    if (!string.IsNullOrEmpty(pendingCaption))
                    {
                        data.SetText(pendingCaption);
                    }
                    Clipboard.SetDataObject(data, true);
                }
            }
            catch { }
            finally
            {
                isInternalClipboardChange = false;
                isSimulatingPaste = false;
            }
        }

        private Icon LoadEmbeddedIcon()
        {
            try
            {
                Assembly asm = Assembly.GetExecutingAssembly();
                using (Stream s = asm.GetManifestResourceStream("CRTask.ico"))
                {
                    if (s != null)
                        return new Icon(s);
                }
            }
            catch { }
            return SystemIcons.Application;
        }

        private Image LoadEmbeddedLogoPng()
        {
            try
            {
                Assembly asm = Assembly.GetExecutingAssembly();
                Stream s = asm.GetManifestResourceStream("CRTaskLogo.png");
                if (s != null)
                {
                    return Image.FromStream(s);
                }
            }
            catch { }
            return null;
        }

        private void ApplyWindowIcon(IntPtr hWnd)
        {
            if (hWnd == IntPtr.Zero || appIcon == null) return;
            try
            {
                IntPtr hIcon = appIcon.Handle;
                SendMessage(hWnd, WM_SETICON, (IntPtr)ICON_BIG, hIcon);
                SendMessage(hWnd, WM_SETICON, (IntPtr)ICON_SMALL, hIcon);
                if (IntPtr.Size == 8)
                {
                    SetClassLongPtr64(hWnd, GCLP_HICON, hIcon);
                    SetClassLongPtr64(hWnd, GCLP_HICONSM, hIcon);
                }
                else
                {
                    SetClassLong32(hWnd, GCLP_HICON, (uint)hIcon.ToInt32());
                    SetClassLong32(hWnd, GCLP_HICONSM, (uint)hIcon.ToInt32());
                }
                lastIconAppliedHwnd = hWnd;
            }
            catch { }
        }

        private void BringWindowToFront(IntPtr hWnd)
        {
            if (hWnd == IntPtr.Zero || !IsWindow(hWnd)) return;
            try
            {
                ShowWindow(hWnd, SW_RESTORE);
                ShowWindow(hWnd, SW_SHOWNORMAL);
                SetWindowPos(hWnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
                SetForegroundWindow(hWnd);
                SetWindowPos(hWnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
            }
            catch { }
        }

        private void ShowNativeAlarmCard(string messageText, string headerTitle = "🔔 ALARME DE MENSAGEM • CR TASK")
        {
            try
            {
                if (activeAlarmToast != null && !activeAlarmToast.IsDisposed)
                {
                    activeAlarmToast.Close();
                }

                Form toast = new Form
                {
                    FormBorderStyle = FormBorderStyle.None,
                    StartPosition = FormStartPosition.Manual,
                    ShowInTaskbar = false,
                    TopMost = true,
                    BackColor = Color.FromArgb(15, 23, 42),
                    Size = new Size(380, 118)
                };

                try
                {
                    toast.Region = Region.FromHrgn(CreateRoundRectRgn(0, 0, toast.Width, toast.Height, 16, 16));
                }
                catch { }

                Rectangle workArea = Screen.PrimaryScreen.WorkingArea;
                toast.Location = new Point(workArea.Right - toast.Width - 18, workArea.Bottom - toast.Height - 18);

                Panel topAccent = new Panel
                {
                    Dock = DockStyle.Top,
                    Height = 5,
                    BackColor = Color.FromArgb(245, 158, 11)
                };
                toast.Controls.Add(topAccent);

                // Crisp high-res PNG Logo renderer (fixes GDI+ Icon.ToBitmap noise bug)
                Panel logoPanel = new Panel
                {
                    Location = new Point(16, 22),
                    Size = new Size(46, 46),
                    BackColor = Color.FromArgb(5, 19, 34)
                };
                logoPanel.Paint += (s, pe) =>
                {
                    pe.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                    pe.Graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    if (logoPngImage != null)
                    {
                        pe.Graphics.DrawImage(logoPngImage, new Rectangle(3, 3, 40, 40));
                    }
                };
                toast.Controls.Add(logoPanel);

                Label lblHeader = new Label
                {
                    Text = headerTitle,
                    ForeColor = Color.FromArgb(251, 191, 36),
                    Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                    Location = new Point(74, 16),
                    AutoSize = true
                };
                toast.Controls.Add(lblHeader);

                Label lblBody = new Label
                {
                    Text = messageText,
                    ForeColor = Color.White,
                    Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                    Location = new Point(74, 36),
                    Size = new Size(290, 38),
                    AutoEllipsis = true
                };
                toast.Controls.Add(lblBody);

                Button btnOpen = new Button
                {
                    Text = "Abrir CR Task Agora",
                    BackColor = Color.FromArgb(16, 185, 129),
                    ForeColor = Color.White,
                    FlatStyle = FlatStyle.Flat,
                    Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                    Location = new Point(74, 78),
                    Size = new Size(155, 28),
                    Cursor = Cursors.Hand
                };
                btnOpen.FlatAppearance.BorderSize = 0;
                btnOpen.Click += (s, e) =>
                {
                    RestoreOrLaunchApp();
                    toast.Close();
                };
                toast.Controls.Add(btnOpen);

                Button btnDismiss = new Button
                {
                    Text = "Fechar",
                    BackColor = Color.FromArgb(30, 41, 59),
                    ForeColor = Color.FromArgb(148, 163, 184),
                    FlatStyle = FlatStyle.Flat,
                    Font = new Font("Segoe UI", 8f, FontStyle.Regular),
                    Location = new Point(238, 78),
                    Size = new Size(80, 28),
                    Cursor = Cursors.Hand
                };
                btnDismiss.FlatAppearance.BorderSize = 0;
                btnDismiss.Click += (s, e) => toast.Close();
                toast.Controls.Add(btnDismiss);

                toast.Click += (s, e) =>
                {
                    RestoreOrLaunchApp();
                    toast.Close();
                };

                System.Windows.Forms.Timer closeTimer = new System.Windows.Forms.Timer { Interval = 12000 };
                closeTimer.Tick += (s, e) =>
                {
                    closeTimer.Stop();
                    if (!toast.IsDisposed) toast.Close();
                };
                closeTimer.Start();

                activeAlarmToast = toast;
                toast.Show();
            }
            catch { }
        }

        private void EnsureInstalledAndShortcut()
        {
            try
            {
                if (!Directory.Exists(appDataFolder))
                    Directory.CreateDirectory(appDataFolder);

                string currentExe = Application.ExecutablePath;
                if (!string.Equals(Path.GetFullPath(currentExe), Path.GetFullPath(installedExePath), StringComparison.OrdinalIgnoreCase))
                {
                    File.Copy(currentExe, installedExePath, true);
                }

                Assembly asm = Assembly.GetExecutingAssembly();
                using (Stream s = asm.GetManifestResourceStream("CRTask.ico"))
                {
                    if (s != null)
                    {
                        using (FileStream fs = new FileStream(installedIconPath, FileMode.Create, FileAccess.Write))
                        {
                            s.CopyTo(fs);
                        }
                    }
                }

                CreateDesktopShortcut();
                SetStartup(true);
            }
            catch { }
        }

        private void CreateDesktopShortcut()
        {
            try
            {
                string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string shortcutPath = Path.Combine(desktopDir, "CR Task.lnk");
                string targetExe = File.Exists(installedExePath) ? installedExePath : Application.ExecutablePath;

                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null)
                {
                    object shell = Activator.CreateInstance(shellType);
                    object shortcut = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { shortcutPath });
                    Type shortcutType = shortcut.GetType();
                    shortcutType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, shortcut, new object[] { targetExe });
                    shortcutType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, shortcut, new object[] { appDataFolder });
                    shortcutType.InvokeMember("Description", BindingFlags.SetProperty, null, shortcut, new object[] { "CR Task - Gestão e Envio de Mensagens" });
                    if (File.Exists(installedIconPath))
                    {
                        shortcutType.InvokeMember("IconLocation", BindingFlags.SetProperty, null, shortcut, new object[] { installedIconPath });
                    }
                    shortcutType.InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
                }
            }
            catch { }
        }

        private bool IsStartupEnabled()
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RUN_REGISTRY_KEY, false))
                {
                    if (key != null)
                    {
                        object val = key.GetValue(RUN_VALUE_NAME);
                        return val != null;
                    }
                }
            }
            catch { }
            return false;
        }

        private void SetStartup(bool enable)
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RUN_REGISTRY_KEY, true))
                {
                    if (key != null)
                    {
                        if (enable)
                        {
                            string targetExe = File.Exists(installedExePath) ? installedExePath : Application.ExecutablePath;
                            key.SetValue(RUN_VALUE_NAME, "\"" + targetExe + "\"");
                        }
                        else
                        {
                            key.DeleteValue(RUN_VALUE_NAME, false);
                        }
                    }
                }
            }
            catch { }
        }

        private void ToggleStartup()
        {
            bool nextState = !IsStartupEnabled();
            SetStartup(nextState);
            startupMenuItem.Checked = IsStartupEnabled();
        }

        private string FindBrowserExecutable()
        {
            string[] candidates = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe")
            };

            foreach (string path in candidates)
            {
                if (!string.IsNullOrEmpty(path) && File.Exists(path))
                    return path;
            }
            return "msedge.exe";
        }

        private void LaunchBrowserApp()
        {
            try
            {
                lastLaunchAttempt = DateTime.Now;
                string browserExe = FindBrowserExecutable();
                string args = string.Format(
                    "--user-data-dir=\"{0}\" --app=\"{1}\" --disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling,AudioServiceOutOfProcess --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --autoplay-policy=no-user-gesture-required",
                    profileFolder,
                    APP_URL
                );

                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = browserExe,
                    Arguments = args,
                    UseShellExecute = false
                };
                Process.Start(psi);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erro ao iniciar o CR Task Desktop: " + ex.Message, "CR Task", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private IntPtr FindCRTaskWindow()
        {
            IntPtr found = IntPtr.Zero;
            EnumWindows((hWnd, lParam) =>
            {
                StringBuilder className = new StringBuilder(256);
                GetClassName(hWnd, className, className.Capacity);
                if (!className.ToString().StartsWith("Chrome_WidgetWin_"))
                    return true;

                StringBuilder title = new StringBuilder(512);
                GetWindowText(hWnd, title, title.Capacity);
                string titleStr = title.ToString();

                if (string.IsNullOrEmpty(titleStr))
                    return true;

                bool hasCRTaskTitle = titleStr.IndexOf("CR Admin Workspace", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                      titleStr.IndexOf("CR Task", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                      titleStr.IndexOf("crtask1.vercel.app", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                      titleStr.IndexOf("[ALARME]", StringComparison.OrdinalIgnoreCase) >= 0;

                bool isNormalBrowserTab = titleStr.EndsWith("- Google Chrome", StringComparison.OrdinalIgnoreCase) ||
                                          titleStr.EndsWith("- Microsoft\u200B Edge", StringComparison.OrdinalIgnoreCase) ||
                                          titleStr.EndsWith("- Microsoft Edge", StringComparison.OrdinalIgnoreCase);

                if (hasCRTaskTitle && !isNormalBrowserTab)
                {
                    found = hWnd;
                    return false;
                }
                return true;
            }, IntPtr.Zero);

            return found;
        }

        private string GetWindowTitle(IntPtr hWnd)
        {
            if (hWnd == IntPtr.Zero) return "";
            StringBuilder sb = new StringBuilder(512);
            GetWindowText(hWnd, sb, sb.Capacity);
            return sb.ToString();
        }

        private void HideAppToTray()
        {
            if (appHwnd != IntPtr.Zero && IsWindow(appHwnd))
            {
                ShowWindow(appHwnd, SW_HIDE);
            }
        }

        private void RestoreOrLaunchApp()
        {
            launchHiddenNext = false;
            if (appHwnd != IntPtr.Zero && IsWindow(appHwnd))
            {
                ApplyWindowIcon(appHwnd);
                BringWindowToFront(appHwnd);
            }
            else
            {
                appHwnd = FindCRTaskWindow();
                if (appHwnd != IntPtr.Zero && IsWindow(appHwnd))
                {
                    ApplyWindowIcon(appHwnd);
                    BringWindowToFront(appHwnd);
                }
                else
                {
                    LaunchBrowserApp();
                }
            }
        }

        private void MonitorTimer_Tick(object sender, EventArgs e)
        {
            if (isExiting) return;

            if (showEvent.WaitOne(0))
            {
                RestoreOrLaunchApp();
                return;
            }

            if (appHwnd == IntPtr.Zero || !IsWindow(appHwnd))
            {
                appHwnd = FindCRTaskWindow();

                if (appHwnd != IntPtr.Zero)
                {
                    ApplyWindowIcon(appHwnd);
                    if (launchHiddenNext)
                    {
                        launchHiddenNext = false;
                        HideAppToTray();
                    }
                }
                else if ((DateTime.Now - lastLaunchAttempt).TotalSeconds > 6)
                {
                    launchHiddenNext = true;
                    LaunchBrowserApp();
                }
                return;
            }

            if (lastIconAppliedHwnd != appHwnd)
            {
                ApplyWindowIcon(appHwnd);
            }

            SendMessage(appHwnd, WM_SETICON, (IntPtr)ICON_BIG, appIcon.Handle);
            SendMessage(appHwnd, WM_SETICON, (IntPtr)ICON_SMALL, appIcon.Handle);

            if (IsIconic(appHwnd))
            {
                HideAppToTray();
            }

            string currentTitle = GetWindowTitle(appHwnd);
            if (currentTitle.IndexOf("[ALARME]", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                if (currentTitle != lastAlarmTitle)
                {
                    lastAlarmTitle = currentTitle;
                    string cleanMsg = currentTitle
                        .Replace("🔔", "")
                        .Replace("[ALARME]", "")
                        .Replace("- CR Task", "")
                        .Replace("• Gestão Operacional", "")
                        .Replace("- CR Admin Workspace", "")
                        .Trim();
                    if (string.IsNullOrEmpty(cleanMsg))
                        cleanMsg = "Hora de enviar uma mensagem programada no WhatsApp!";

                    try { SystemSounds.Exclamation.Play(); } catch { }

                    // Exibe apenas o Card próprio do aplicativo (sem duplicar com a notificação do Windows)
                    ShowNativeAlarmCard(cleanMsg);
                    BringWindowToFront(appHwnd);
                }
            }
            else
            {
                lastAlarmTitle = "";
            }
        }

        private void ExitApplication()
        {
            isExiting = true;
            monitorTimer.Stop();

            try
            {
                if (keyboardHookId != IntPtr.Zero)
                {
                    UnhookWindowsHookEx(keyboardHookId);
                    keyboardHookId = IntPtr.Zero;
                }
            }
            catch { }

            try
            {
                if (clipboardForm != null && !clipboardForm.IsDisposed)
                {
                    clipboardForm.Close();
                }
            }
            catch { }

            try
            {
                if (appHwnd != IntPtr.Zero && IsWindow(appHwnd))
                {
                    PostMessage(appHwnd, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
                }
            }
            catch { }

            trayIcon.Visible = false;
            trayIcon.Dispose();
            Application.Exit();
        }

        private class ClipboardWatcherForm : Form
        {
            private readonly Action onUpdate;

            [DllImport("user32.dll", SetLastError = true)]
            private static extern bool AddClipboardFormatListener(IntPtr hwnd);

            [DllImport("user32.dll", SetLastError = true)]
            private static extern bool RemoveClipboardFormatListener(IntPtr hwnd);

            public ClipboardWatcherForm(Action onUpdateCallback)
            {
                onUpdate = onUpdateCallback;
                ShowInTaskbar = false;
                WindowState = FormWindowState.Minimized;
                FormBorderStyle = FormBorderStyle.None;
                CreateHandle();
            }

            protected override void OnHandleCreated(EventArgs e)
            {
                base.OnHandleCreated(e);
                AddClipboardFormatListener(Handle);
            }

            protected override void OnHandleDestroyed(EventArgs e)
            {
                RemoveClipboardFormatListener(Handle);
                base.OnHandleDestroyed(e);
            }

            protected override void WndProc(ref Message m)
            {
                if (m.Msg == 0x031D) // WM_CLIPBOARDUPDATE
                {
                    if (onUpdate != null) onUpdate();
                }
                base.WndProc(ref m);
            }
        }
    }
}
