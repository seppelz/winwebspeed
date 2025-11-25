# Code Signing Guide for WinWebSpeed

## Understanding SmartScreen Warning

Microsoft Defender SmartScreen is showing a warning because the executable is not code-signed. This is a security feature that protects users from potentially malicious software.

## Why Code Signing Matters

1. **User Trust**: Signed executables show the publisher name instead of "Unknown Publisher"
2. **No SmartScreen Warning**: Properly signed apps don't trigger SmartScreen warnings
3. **Professional Appearance**: Shows your app is legitimate and maintained
4. **Windows Startup**: Signed apps display correctly in Windows startup lists

## Options for Code Signing

### Option 1: Purchase a Code Signing Certificate (Recommended for Public Release)

**Cost**: $200-400/year (varies by provider)

**Providers**:
- **DigiCert**: https://www.digicert.com/code-signing/
- **Sectigo (formerly Comodo)**: https://sectigo.com/ssl-certificates-tls/code-signing
- **GlobalSign**: https://www.globalsign.com/en/code-signing-certificate
- **Certum**: https://www.certum.eu/en/code-signing-certificate/

**Steps**:
1. Purchase a code signing certificate from a trusted Certificate Authority (CA)
2. Install the certificate on your development machine
3. Sign the executable using `signtool.exe` (included with Windows SDK)

**Signing Command**:
```powershell
signtool sign /f "path\to\certificate.pfx" /p "password" /t http://timestamp.digicert.com "WinWebSpeed.exe"
```

### Option 2: Self-Signed Certificate (For Testing Only)

**Note**: Self-signed certificates will still trigger SmartScreen warnings, but they can be useful for internal testing.

**Steps**:
1. Create a self-signed certificate:
```powershell
New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=WinWebSpeed" -KeyUsage DigitalSignature -FriendlyName "WinWebSpeed Code Signing" -CertStoreLocation Cert:\CurrentUser\My
```

2. Export the certificate:
```powershell
$cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Where-Object {$_.Subject -eq "CN=WinWebSpeed"}
Export-PfxCertificate -Cert $cert -FilePath "WinWebSpeed.pfx" -Password (ConvertTo-SecureString -String "YourPassword" -Force -AsPlainText)
```

3. Sign the executable:
```powershell
signtool sign /f "WinWebSpeed.pfx" /p "YourPassword" /t http://timestamp.digicert.com "WinWebSpeed.exe"
```

### Option 3: Build Reputation Over Time (Free, but Slow)

If you distribute your app widely and users download and run it, Windows will eventually build reputation for your executable. This can take months and requires:
- Many downloads from different users
- No malware reports
- Consistent file hash

**Note**: This doesn't work well for frequent updates, as each new version needs to build reputation again.

## Automated Signing in Build Process

You can add code signing to your build process by modifying `WinWebSpeed.csproj`:

```xml
<Target Name="SignExecutable" AfterTargets="Publish">
  <Exec Command="signtool sign /f &quot;$(CertificatePath)&quot; /p &quot;$(CertificatePassword)&quot; /t http://timestamp.digicert.com &quot;$(PublishDir)WinWebSpeed.exe&quot;" 
        Condition="Exists('$(CertificatePath)')" />
</Target>
```

Then set the certificate path and password as MSBuild properties:
```powershell
dotnet publish -c Release -p:CertificatePath="path\to\cert.pfx" -p:CertificatePassword="password"
```

## Recommendations

1. **For Public Release**: Purchase a code signing certificate from a trusted CA
2. **For Testing**: Use a self-signed certificate (users will still see warnings)
3. **For Open Source**: Consider using GitHub Sponsors or similar to fund a code signing certificate

## Additional Resources

- [Microsoft Code Signing Documentation](https://docs.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools)
- [SignTool Documentation](https://docs.microsoft.com/en-us/windows/win32/seccrypto/signtool)
- [Windows Defender SmartScreen](https://docs.microsoft.com/en-us/windows/security/threat-protection/microsoft-defender-smartscreen/microsoft-defender-smartscreen-overview)

