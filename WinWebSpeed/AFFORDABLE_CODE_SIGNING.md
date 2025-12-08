# Affordable Code Signing Certificate Options

## Budget-Friendly Options (Under $250/year)

### 1. **Comodo (Sectigo) Code Signing Certificate** ⭐ Best Value
- **Price**: ~$211-226/year
- **Provider**: Sectigo (formerly Comodo)
- **Type**: Organization Validation (OV)
- **Platforms**: Windows, macOS
- **Issuance Time**: 1-3 business days
- **Where to Buy**:
  - [CodeSigningStore.com](https://codesigningstore.com/code-signing/comodo-code-signing-certificate)
  - [CheapCodeSignCert.com](https://cheapcodesigncert.com/sectigo-code-signing)
- **Pros**: 
  - Most affordable trusted option
  - Widely recognized
  - Good for individual developers and small businesses
- **Cons**: Requires business registration for OV certificates

### 2. **Certera Code Signing Certificate**
- **Price**: ~$216/year
- **Provider**: Certera
- **Type**: Organization Validation (OV)
- **Platforms**: Windows, macOS
- **Issuance Time**: 1-3 business days
- **Where to Buy**: [Certera.com](https://certera.com/code-signing/certera-code-signing)
- **Pros**: 
  - Competitive pricing
  - Good customer support
  - Modern certificate authority
- **Cons**: Less established than Sectigo/DigiCert

### 3. **Sectigo Code Signing Certificate**
- **Price**: ~$226/year
- **Provider**: Sectigo
- **Type**: Organization Validation (OV)
- **Platforms**: Windows, macOS
- **Issuance Time**: 1-3 business days
- **Where to Buy**: [CheapCodeSignCert.com](https://cheapcodesigncert.com/sectigo-code-signing)
- **Pros**: 
  - Well-established provider
  - Good reputation
  - Reliable support
- **Cons**: Slightly more expensive than Comodo

## Premium Options (Higher Trust)

### 4. **DigiCert Code Signing Certificate**
- **Price**: ~$386/year
- **Provider**: DigiCert
- **Type**: Organization Validation (OV)
- **Platforms**: Windows, macOS
- **Issuance Time**: 1-2 business days
- **Where to Buy**: [CheapCodeSignCert.com](https://www.cheapcodesigncert.com/digicert-code-signing)
- **Pros**: 
  - Highest trust level
  - Best for enterprise applications
  - Excellent support
- **Cons**: More expensive

## Important Requirements (As of 2023)

⚠️ **Hardware Security Module (HSM) Required**: 
- As of June 1, 2023, code signing certificate keys **must** be stored on a hardware security module
- Must be FIPS 140 Level 2 compliant or equivalent
- Options:
  - **USB Token**: YubiKey, SafeNet eToken, etc. (~$50-150)
  - **Cloud HSM**: Some providers offer cloud-based HSM solutions
  - **Windows Hello**: Some providers support Windows Hello for Business

## Cost Breakdown Example

**Comodo Code Signing Certificate (Most Affordable)**:
- Certificate: ~$211/year
- USB Token (if needed): ~$50-100 (one-time)
- **Total First Year**: ~$261-311
- **Annual Renewal**: ~$211/year

## Free/Alternative Options

### ❌ No True Free Options
Unfortunately, there are **no legitimate free code signing certificates** for public distribution. However:

### Alternative Approaches:

1. **GitHub Sponsors / Community Funding**
   - Use GitHub Sponsors to fund a code signing certificate
   - Many open source projects do this
   - Users can contribute small amounts

2. **Self-Signed Certificate** (Not Recommended)
   - Free but still triggers SmartScreen warnings
   - Only useful for internal testing
   - Not suitable for public distribution

3. **Build Reputation Over Time** (Free but Slow)
   - Each new build loses reputation
   - Takes months to build up
   - Not practical for frequent updates

## Recommendations for WinWebSpeed

### Option 1: Start with Comodo/Sectigo (~$211/year)
- **Best for**: Getting started with code signing
- **Cost**: Most affordable trusted option
- **Action**: Purchase from CodeSigningStore.com or CheapCodeSignCert.com

### Option 2: Community Funding via GitHub Sponsors
- **Best for**: Open source projects with community support
- **Cost**: Free (if community funds it)
- **Action**: 
  1. Set up GitHub Sponsors
  2. Add a funding goal for code signing certificate
  3. Add a note on your website/README about the need

### Option 3: Wait and Build Reputation
- **Best for**: Projects with infrequent updates
- **Cost**: Free
- **Limitation**: Each rebuild loses reputation
- **Not Recommended**: Given you're actively developing

## Where to Purchase

### Recommended Resellers (Often Cheaper than Direct):
1. **CodeSigningStore.com** - Often has discounts
2. **CheapCodeSignCert.com** - Competitive pricing
3. **SSL2BUY.com** - Good deals on Sectigo certificates
4. **Namecheap** - Sometimes offers code signing certificates

### Direct from Providers:
- **Sectigo.com** - Direct purchase
- **DigiCert.com** - Direct purchase (more expensive)

## Validation Process

For OV (Organization Validation) certificates, you'll need:
1. **Business Registration**: Proof of business existence
   - Business license
   - Articles of incorporation
   - Or similar document
2. **Identity Verification**: 
   - Government-issued ID
   - Proof of address
3. **Phone Verification**: 
   - Business phone number
   - May need to answer a call

**Note**: If you're an individual developer without a business, you may need to:
- Register as a sole proprietorship/LLC (varies by country)
- Or look for "Individual Code Signing" certificates (less common, may be more expensive)

## Signing Your Executable

Once you have the certificate:

```powershell
# Sign the executable
signtool sign /f "certificate.pfx" /p "password" /t http://timestamp.digicert.com "WinWebSpeed.exe"

# Verify the signature
signtool verify /pa "WinWebSpeed.exe"
```

## Cost-Saving Tips

1. **Buy Multi-Year**: Some providers offer discounts for 2-3 year purchases
2. **Shop Around**: Prices vary significantly between resellers
3. **Look for Promotions**: Black Friday, New Year sales often have discounts
4. **Consider EV Certificates**: More expensive upfront but may provide better trust

## Next Steps

1. **Decide on Budget**: Can you afford ~$211-226/year?
2. **Check Business Status**: Do you have a registered business?
3. **Choose Provider**: Comodo/Sectigo is recommended for best value
4. **Purchase Certificate**: Use one of the resellers listed above
5. **Complete Validation**: Follow provider's instructions
6. **Sign Executable**: Use signtool to sign your releases

## Additional Resources

- [Microsoft Code Signing Best Practices](https://docs.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools)
- [Sectigo Code Signing Guide](https://sectigo.com/resource-library/code-signing-certificate-guide)
- [DigiCert Code Signing Documentation](https://www.digicert.com/support/resources/code-signing)



