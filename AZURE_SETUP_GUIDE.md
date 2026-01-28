# Azure Container Apps Setup Guide for Beginners

This guide will walk you through setting up Azure Container Apps to deploy your Node.js application.

## Prerequisites

- An Azure account (create one at https://azure.microsoft.com/free/)
- Azure CLI installed on your local machine
- Basic understanding of Docker

## Step 1: Install Azure CLI

### macOS
```bash
brew install azure-cli
```

### Linux
```bash
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

### Windows
Download and install from: https://aka.ms/installazurecliwindows

## Step 2: Login to Azure

```bash
az login
```
This will open a browser window for you to sign in to your Azure account.

## Step 3: Set Your Subscription (if you have multiple)

```bash
# List all subscriptions
az account list --output table

# Set the active subscription (replace with your subscription ID)
az account set --subscription "YOUR_SUBSCRIPTION_ID"
```

## Step 4: Create Resource Group

A resource group is a container that holds related resources for your solution.

```bash
az group create --name node-app-proj-rg --location centralindia
```

**Note:** Change `node-app-proj-rg` to your preferred name and `centralindia` to your preferred region.

## Step 5: Create Azure Container Registry (ACR)

ACR is where your Docker images will be stored.

```bash
az acr create \
  --resource-group node-app-proj-rg \
  --name nodeappregistry \
  --sku Basic \
  --admin-enabled true
```

**Important:** 
- Registry name must be globally unique (lowercase, alphanumeric only)
- The `--admin-enabled true` flag enables admin access for easier authentication

## Step 6: Get ACR Credentials

```bash
# Get login server
az acr show --name nodeappregistry --query loginServer --output tsv

# Get admin username
az acr credential show --name nodeappregistry --query username --output tsv

# Get admin password
az acr credential show --name nodeappregistry --query 'passwords[0].value' --output tsv
```

Save these credentials - you'll need them for local testing (optional).

## Step 7: Create Container Apps Environment

Container Apps Environment is a secure boundary around your container apps.

```bash
az containerapp env create \
  --name node-app-env \
  --resource-group node-app-proj-rg \
  --location centralindia
```

## Step 8: Create Container App

This is where your application will run.

```bash
az containerapp create \
  --name node-app \
  --resource-group node-app-proj-rg \
  --environment node-app-env \
  --image nodeappregistry.azurecr.io/node-app:latest \
  --registry-server nodeappregistry.azurecr.io \
  --target-port 3001 \
  --ingress external \
  --cpu 0.25 \
  --memory 0.5Gi \
  --min-replicas 1 \
  --max-replicas 1
```

**Note:** This will fail initially because the image doesn't exist yet. That's okay - we'll push the image in the next steps.

## Step 9: Set Up Azure Service Principal for GitHub Actions

A service principal allows GitHub Actions to authenticate with Azure.

### Option A: Using Azure Portal (Recommended for Beginners)

1. Go to Azure Portal → Azure Active Directory → App registrations
2. Click "New registration"
3. Name: `github-actions-node-app`
4. Supported account types: Single tenant
5. Click "Register"
6. Note the **Application (client) ID** and **Directory (tenant) ID**
7. Go to "Certificates & secrets" → "New client secret"
8. Description: `github-actions-secret`
9. Expires: 24 months (or your preference)
10. Click "Add"
11. **IMPORTANT:** Copy the secret value immediately (you won't see it again!)

12. Go to "API permissions" → "Add a permission" → "Azure Service Management" → "user_impersonation" → "Add permissions"

13. Go to Subscriptions → Your subscription → Access control (IAM) → "Add" → "Add role assignment"
    - Role: **Contributor**
    - Assign access to: User, group, or service principal
    - Select: `github-actions-node-app`
    - Click "Review + assign"

### Option B: Using Azure CLI

```bash
# Create service principal
az ad sp create-for-rbac \
  --name "github-actions-node-app" \
  --role contributor \
  --scopes /subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/node-app-proj-rg \
  --sdk-auth
```

This will output JSON with credentials. Save this output.

## Step 10: Add GitHub Secrets

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Add the following secrets:

   - **AZURE_CLIENT_ID**: The Application (client) ID from Step 9
   - **AZURE_TENANT_ID**: The Directory (tenant) ID from Step 9
   - **AZURE_SUBSCRIPTION_ID**: Your Azure subscription ID
     - Get it with: `az account show --query id --output tsv`
   - **AZURE_CLIENT_SECRET**: The client secret value from Step 9
     - **Important**: This is the secret value, not the secret ID

   **Note**: The workflow requires individual secrets (not the combined AZURE_CREDENTIALS JSON).

## Step 11: Update GitHub Actions Workflow

Edit `.github/workflows/deploy-azure.yml` and update these values if needed:

```yaml
AZURE_WEBAPP_NAME: node-app  # Your Container App name
AZURE_RESOURCE_GROUP: node-app-proj-rg  # Your resource group name
CONTAINER_APP_NAME: node-app  # Your Container App name
REGISTRY_NAME: nodeappregistry  # Your ACR registry name
```

## Step 12: First Manual Deployment (Optional - Test Before GitHub Actions)

Before using GitHub Actions, you can test manually:

```bash
# Login to ACR
az acr login --name nodeappregistry

# Get ACR login server
ACR_LOGIN_SERVER=$(az acr show --name nodeappregistry --resource-group node-app-proj-rg --query loginServer --output tsv)

# Build Docker image locally for Linux/AMD64 (required for Azure)
docker build --platform linux/amd64 -t $ACR_LOGIN_SERVER/node-app:latest .

# Push image to ACR
docker push $ACR_LOGIN_SERVER/node-app:latest

# Update container app with new image
az containerapp update \
  --name node-app \
  --resource-group node-app-proj-rg \
  --image $ACR_LOGIN_SERVER/node-app:latest
```

**Note:** The Basic tier of ACR doesn't support `az acr build` (ACR Tasks). You must build the image locally with Docker and push it.

## Step 13: Deploy via GitHub Actions

1. Push your code to the `main` or `master` branch
2. GitHub Actions will automatically:
   - Build Docker image
   - Push to Azure Container Registry
   - Deploy to Azure Container Apps
3. Monitor deployment in GitHub Actions tab

## Step 14: Get Your Application URL

After deployment, get your app URL:

```bash
az containerapp show \
  --name node-app \
  --resource-group node-app-proj-rg \
  --query properties.configuration.ingress.fqdn \
  --output tsv
```

Or in Azure Portal:
1. Go to Container Apps → `node-app`
2. Copy the **Application Url**

Your app will be accessible at: `https://YOUR_APP_URL`

## Troubleshooting

### Check Container App Logs

```bash
az containerapp logs show \
  --name node-app \
  --resource-group node-app-proj-rg \
  --follow
```

Or in Azure Portal:
- Go to Container Apps → `node-app` → Log stream

### Check Deployment Status

```bash
az containerapp revision list \
  --name node-app \
  --resource-group node-app-proj-rg \
  --output table
```

### Common Issues

1. **Image pull errors**: 
   - Verify ACR registry name is correct
   - Check that admin user is enabled: `az acr update --name nodeappregistry --admin-enabled true`

2. **Authentication errors in GitHub Actions**:
   - Verify all secrets are set correctly
   - Check service principal has Contributor role on resource group

3. **Container fails to start**:
   - Check logs: `az containerapp logs show --name node-app --resource-group node-app-proj-rg`
   - Verify port 3001 is correct in container app configuration

4. **Can't access application**:
   - Verify ingress is set to `external`
   - Check the application URL from Step 14

## Cost Estimation

- Azure Container Apps: Pay-as-you-go, ~$0.000012/vCPU-second + $0.0000015/GB-second
- Azure Container Registry Basic: ~$5/month (includes 10GB storage)
- **Estimated total for small app**: ~$10-15/month
- **Free tier**: $200 credit for first 30 days

## Useful Azure CLI Commands

```bash
# List all container apps
az containerapp list --resource-group node-app-proj-rg --output table

# Show container app details
az containerapp show --name node-app --resource-group node-app-proj-rg

# Update container app
az containerapp update --name node-app --resource-group node-app-proj-rg --image nodeappregistry.azurecr.io/node-app:latest

# Delete everything (cleanup)
az group delete --name node-app-proj-rg --yes --no-wait
```

## Useful Azure Portal Links

- Container Apps: https://portal.azure.com/#view/Microsoft_Azure_ContainerApps
- Container Registry: https://portal.azure.com/#view/Microsoft_Azure_ContainerRegistries
- Resource Groups: https://portal.azure.com/#view/HubsExtension/BrowseResourceGroups
- App Registrations: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps

## Next Steps

- Set up custom domain
- Configure environment variables
- Set up auto-scaling
- Add health checks
- Set up monitoring and alerts
- Configure HTTPS (automatically enabled)

## Alternative: Azure Container Instances (Simpler but Less Features)

If you prefer a simpler option, you can use Azure Container Instances instead:

```bash
# Create container instance
az container create \
  --resource-group node-app-proj-rg \
  --name node-app \
  --image nodeappregistry.azurecr.io/node-app:latest \
  --registry-login-server nodeappregistry.azurecr.io \
  --registry-username YOUR_ACR_USERNAME \
  --registry-password YOUR_ACR_PASSWORD \
  --dns-name-label node-app-unique \
  --ports 3001 \
  --cpu 1 \
  --memory 1
```

Container Apps is recommended as it's more modern and has better features.
