using System;
using System.Threading;
using System.Windows;

namespace WinWebSpeed;

/// <summary>
/// Interaction logic for App.xaml
/// </summary>
public partial class App : System.Windows.Application
{
    private Mutex? _singleInstanceMutex;

    protected override void OnStartup(StartupEventArgs e)
    {
        const string mutexName = "WinWebSpeed_SingleInstance_Mutex";
        bool createdNew;

        _singleInstanceMutex = new Mutex(true, mutexName, out createdNew);

        if (!createdNew)
        {
            System.Windows.MessageBox.Show("WinWebSpeed is already running.", "WinWebSpeed", MessageBoxButton.OK, MessageBoxImage.Information);
            Shutdown();
            return;
        }

        base.OnStartup(e);
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _singleInstanceMutex?.ReleaseMutex();
        _singleInstanceMutex?.Dispose();
        _singleInstanceMutex = null;
        base.OnExit(e);
    }
}

