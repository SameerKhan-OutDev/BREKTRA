param([Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
$source = @'
using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
using System.Reflection;
using System.Management.Automation;
using System.Management.Automation.Runspaces;
using System.Threading;
[assembly: AssemblyTitle("BREKTRA Setup")]
[assembly: AssemblyProduct("BREKTRA")]
public static class SetupLauncher {
    [STAThread] public static int Main() {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string script = Path.Combine(root, "Setup-Brektra.ps1");
        if (!File.Exists(script)) {
            MessageBox.Show("Extract the entire BREKTRA ZIP first. Keep Setup_BREKTRA.exe beside its supporting files.", "BREKTRA Setup");
            return 1;
        }
        try {
            Directory.SetCurrentDirectory(root);
            var state = InitialSessionState.CreateDefault();
            state.ExecutionPolicy = Microsoft.PowerShell.ExecutionPolicy.Bypass;
            using (var runspace = RunspaceFactory.CreateRunspace(state)) {
                runspace.ApartmentState = ApartmentState.STA;
                runspace.ThreadOptions = PSThreadOptions.UseCurrentThread;
                runspace.Open();
                using (var shell = PowerShell.Create()) {
                    shell.Runspace = runspace;
                    shell.AddCommand(script);
                    shell.Invoke();
                    return shell.HadErrors ? 1 : 0;
                }
            }
        } catch (Exception error) {
            MessageBox.Show("Windows could not open setup: " + error.Message, "BREKTRA Setup");
            return 1;
        }
    }
}
'@
# Compile in a fresh Windows PowerShell process (.NET Framework is built into Windows).
$automation = [System.Management.Automation.PowerShell].Assembly.Location
Add-Type -TypeDefinition $source -ReferencedAssemblies @('System.Windows.Forms', $automation) -OutputAssembly $Destination -OutputType WindowsApplication
