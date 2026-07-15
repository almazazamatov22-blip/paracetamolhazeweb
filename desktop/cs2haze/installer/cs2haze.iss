#define MyAppName "cs2haze"
#ifndef MyAppVersion
  #error MyAppVersion must be passed by build-cs2haze.ps1
#endif
#define MyAppPublisher "Paracetamol Haze"
#define MyAppExeName "cs2haze.exe"

[Setup]
AppId={{C0F8FE6E-4336-46A1-9C56-5F1A56C2A54E}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\cs2haze
DefaultGroupName=cs2haze
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=..\dist
OutputBaseFilename=CS2Haze-Setup
SetupIconFile=..\assets\cs2haze.ico
UninstallDisplayIcon={app}\cs2haze.exe
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
RestartApplications=no

[Files]
Source: "..\dist\launcher\*"; DestDir: "{app}"; Excludes: "launcher-config.json"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dist\runtime\*"; DestDir: "{app}\runtime"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\assets\cs2haze.ico"; DestDir: "{app}\Assets"; Flags: ignoreversion
Source: "..\launcher\launcher-config.json"; DestDir: "{app}"; Flags: onlyifdoesntexist

[Registry]
Root: HKCU; Subkey: "Software\Classes\cs2haze"; ValueType: string; ValueData: "URL:cs2haze Protocol"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\cs2haze"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\cs2haze\DefaultIcon"; ValueType: string; ValueData: "{app}\cs2haze.exe,0"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\cs2haze\shell\open\command"; ValueType: string; ValueData: """{app}\cs2haze.exe"" ""%1"""; Flags: uninsdeletekey

[Icons]
Name: "{autodesktop}\cs2haze"; Filename: "{app}\cs2haze.exe"; IconFilename: "{app}\Assets\cs2haze.ico"
Name: "{group}\cs2haze"; Filename: "{app}\cs2haze.exe"; IconFilename: "{app}\Assets\cs2haze.ico"

[Run]
Filename: "{app}\cs2haze.exe"; Description: "Запустить cs2haze"; Flags: nowait postinstall skipifsilent
