using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
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
            bool createdNew;
            using (Mutex mutex = new Mutex(true, "CRTaskDesktopAppMutex_v1", out createdNew))
            {
                if (!createdNew)
                {
                    try
                    {
                        EventWaitHandle showEvent = EventWaitHandle.OpenExisting("CRTaskDesktopShowEvent_v1");
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

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

        private const int SW_HIDE = 0;
        private const int SW_SHOWNORMAL = 1;
        private const int SW_RESTORE = 9;
        private const uint WM_CLOSE = 0x0010;

        private const string APP_URL = "https://crtask1.vercel.app/mensagens";
        private const string RUN_REGISTRY_KEY = @"Software\Microsoft\Windows\CurrentVersion\Run";
        private const string RUN_VALUE_NAME = "CRTaskDesktop";

        private NotifyIcon trayIcon;
        private System.Windows.Forms.Timer monitorTimer;
        private EventWaitHandle showEvent;
        private IntPtr appHwnd = IntPtr.Zero;
        private bool isHiddenToTray = false;
        private bool isExiting = false;
        private bool shownFirstMinimizeTip = false;
        private string lastAlarmTitle = "";
        private DateTime lastLaunchAttempt = DateTime.MinValue;
        private bool launchHiddenNext = false;

        private string appDataFolder;
        private string installedExePath;
        private string installedIconPath;
        private string profileFolder;
        private ToolStripMenuItem startupMenuItem;

        public TrayApplicationContext()
        {
            appDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CRTaskApp");
            installedExePath = Path.Combine(appDataFolder, "CR-Task-Desktop.exe");
            installedIconPath = Path.Combine(appDataFolder, "cr-task.ico");
            profileFolder = Path.Combine(appDataFolder, "Profile");

            EnsureInstalledAndShortcut();

            Icon appIcon = LoadEmbeddedIcon();

            ContextMenuStrip menu = new ContextMenuStrip();

            ToolStripMenuItem openItem = new ToolStripMenuItem("Abrir CR Task");
            openItem.Font = new Font(openItem.Font, FontStyle.Bold);
            openItem.Click += (s, e) => RestoreOrLaunchApp();
            menu.Items.Add(openItem);

            ToolStripMenuItem hideItem = new ToolStripMenuItem("Minimizar para a Bandeja (^)");
            hideItem.Click += (s, e) => HideAppToTray(false);
            menu.Items.Add(hideItem);

            menu.Items.Add(new ToolStripSeparator());

            startupMenuItem = new ToolStripMenuItem("Iniciar junto com o Windows");
            startupMenuItem.Checked = IsStartupEnabled();
            startupMenuItem.Click += (s, e) => ToggleStartup();
            menu.Items.Add(startupMenuItem);

            ToolStripMenuItem shortcutItem = new ToolStripMenuItem("Criar Atalho na Área de Trabalho");
            shortcutItem.Click += (s, e) =>
            {
                CreateDesktopShortcut();
                trayIcon.ShowBalloonTip(3000, "CR Task Desktop", "Atalho criado na Área de Trabalho com sucesso!", ToolTipIcon.Info);
            };
            menu.Items.Add(shortcutItem);

            menu.Items.Add(new ToolStripSeparator());

            ToolStripMenuItem exitItem = new ToolStripMenuItem("Sair Completamente");
            exitItem.Click += (s, e) => ExitApplication();
            menu.Items.Add(exitItem);

            trayIcon = new NotifyIcon
            {
                Icon = appIcon,
                Text = "CR Task • Rodando em 2º Plano",
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
            trayIcon.BalloonTipClicked += (s, e) => RestoreOrLaunchApp();

            showEvent = new EventWaitHandle(false, EventResetMode.AutoReset, "CRTaskDesktopShowEvent_v1");

            LaunchBrowserApp();

            monitorTimer = new System.Windows.Forms.Timer();
            monitorTimer.Interval = 250;
            monitorTimer.Tick += MonitorTimer_Tick;
            monitorTimer.Start();
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

                string firstRunFlag = Path.Combine(appDataFolder, ".installed_v1");
                if (!File.Exists(firstRunFlag))
                {
                    CreateDesktopShortcut();
                    SetStartup(true);
                    File.WriteAllText(firstRunFlag, DateTime.Now.ToString("O"));
                }
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
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe")
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
                    "--user-data-dir=\"{0}\" --app=\"{1}\" --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --autoplay-policy=no-user-gesture-required",
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

        private void HideAppToTray(bool showFirstTimeBalloon)
        {
            if (appHwnd != IntPtr.Zero && IsWindow(appHwnd))
            {
                ShowWindow(appHwnd, SW_HIDE);
                isHiddenToTray = true;

                if (showFirstTimeBalloon && !shownFirstMinimizeTip)
                {
                    shownFirstMinimizeTip = true;
                    trayIcon.ShowBalloonTip(
                        4000,
                        "CR Task em 2º Plano",
                        "O CR Task foi minimizado para a bandeja do sistema (^). Os alarmes continuarão tocando normalmente!",
                        ToolTipIcon.Info
                    );
                }
            }
        }

        private void RestoreOrLaunchApp()
        {
            launchHiddenNext = false;
            if (appHwnd != IntPtr.Zero && IsWindow(appHwnd))
            {
                ShowWindow(appHwnd, SW_RESTORE);
                ShowWindow(appHwnd, SW_SHOWNORMAL);
                SetForegroundWindow(appHwnd);
                isHiddenToTray = false;
            }
            else
            {
                appHwnd = FindCRTaskWindow();
                if (appHwnd != IntPtr.Zero && IsWindow(appHwnd))
                {
                    ShowWindow(appHwnd, SW_RESTORE);
                    ShowWindow(appHwnd, SW_SHOWNORMAL);
                    SetForegroundWindow(appHwnd);
                    isHiddenToTray = false;
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

                if (appHwnd != IntPtr.Zero && launchHiddenNext)
                {
                    launchHiddenNext = false;
                    HideAppToTray(false);
                }
                else if (appHwnd == IntPtr.Zero && (DateTime.Now - lastLaunchAttempt).TotalSeconds > 6)
                {
                    // Respawn hidden in background if user clicked X so alarms never stop
                    launchHiddenNext = true;
                    LaunchBrowserApp();
                    if (!shownFirstMinimizeTip)
                    {
                        shownFirstMinimizeTip = true;
                        trayIcon.ShowBalloonTip(
                            4000,
                            "CR Task continua na Bandeja (^)",
                            "A janela foi fechada, mas o CR Task segue ativo na bandeja para tocar os alarmes. Para fechar tudo, clique com o botão direito no ícone -> Sair.",
                            ToolTipIcon.Info
                        );
                    }
                }
                return;
            }

            // If user clicked Minimize (_), hide window from Taskbar into the System Tray (^)
            if (IsIconic(appHwnd))
            {
                HideAppToTray(true);
            }

            // Monitor window title for "[ALARME]"
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
                        .Replace("- CR Admin Workspace", "")
                        .Trim();
                    if (string.IsNullOrEmpty(cleanMsg))
                        cleanMsg = "Hora de enviar uma mensagem programada no WhatsApp!";

                    trayIcon.ShowBalloonTip(
                        10000,
                        "🔔 Alarme de Mensagem — CR Task",
                        cleanMsg,
                        ToolTipIcon.Warning
                    );

                    // Restore and focus window automatically when alarm rings
                    ShowWindow(appHwnd, SW_RESTORE);
                    ShowWindow(appHwnd, SW_SHOWNORMAL);
                    SetForegroundWindow(appHwnd);
                    isHiddenToTray = false;
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
    }
}
