# Android APK Signing Setup

## 1. Generate a Keystore

Run this command locally (keep the keystore file safe - you'll need it for future updates):

```bash
keytool -genkey -v -keystore release.keystore -alias receipt-generator -keyalg RSA -keysize 2048 -validity 10000
```

You'll be prompted to enter:
- **Keystore password**: Choose a strong password
- **Key password**: Can be same as keystore password
- **Name, Organization, etc.**: Fill in your details

## 2. Convert Keystore to Base64

```bash
base64 -i release.keystore -o keystore_base64.txt
```

Or on Linux:
```bash
base64 release.keystore > keystore_base64.txt
```

## 3. Add GitHub Secrets

Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret

Add these 4 secrets:

| Secret Name | Value |
|-------------|-------|
| `ANDROID_KEYSTORE_BASE64` | Contents of `keystore_base64.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | Your keystore password |
| `ANDROID_KEY_PASSWORD` | Your key password |
| `ANDROID_KEY_ALIAS` | `receipt-generator` (or whatever alias you used) |

## 4. Trigger a Build

Push a tag to trigger the build:
```bash
git tag v1.0.0
git push origin v1.0.0
```

Or manually trigger via GitHub Actions → "Run workflow"

## Important Notes

- **Keep your keystore safe!** If you lose it, you cannot update your app on Play Store
- **Never commit** the keystore or passwords to the repository
- Store a backup of `keystore/release.keystore` in a secure location
- The same keystore must be used for all future app updates
- The `keystore/` folder is already in `.gitignore`
