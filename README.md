# Welcome to Asset Audit.  
This example application is built to show people how to use Adobe AEM Assets and Adobes broader extensibilty platform to preform inspection of Assets after they have been uploaded to AEM.  

In this code base we will be waiting for the AEM Asset Processing Complete IO Event and then doing some work against the newly processed asset.  When we inspect the event we will be looking to see if the asset proccessed was a PSD.  If it was a PSD we want to take that file and process it with the Firefly services Photoshop api and get the manifest file.  The manifest file is then returned by the service and we will evaluate the manifest to see what features were used to construct the photoshop file.  We will count then rank what we find then we will provide a compatibilty report and set some metadata on the processed Asset.


![Architecture Diagram](https://github.com/davidbenge/express_friendly/blob/main/demo/Pfizer%20-%20Express%20Safe%20Audit.png?raw=true)

This code is not warrentied by Adobe and is provided for demonstration use. 


## Setup

- Populate the `.env` file in the project root and fill it as shown [below](#env)

## developer.adobe.com setup
1. **Create App Builder project from template**: Login to developer.adobe.com and go to console and click the `Create new project` button.  Select `Project from template` then `App Builder` type project.

2. **Add Services**: In the STAGE workspace add the following Services and have them all use the same `OAuth Server-to-Server` credential which you will create when you add the first service then when prompted select use existing when adding all the next services.
  - Photoshop - Firefly Services
  - I/O Events
  - I/O Management API

3. **Add Events**: In the STAGE workspace add the following Events which we will map to our actions after the code is deployed.
  - AEM Assets
  - Imaging API Events

## Local Dev

- `aio app run` to start your local Dev server
- App will run on `localhost:9080` by default

By default the UI will be served locally but actions will be deployed and served from Adobe I/O Runtime. To start a
local serverless stack and also run your actions locally use the `aio app run --local` option.

## Deploy & Cleanup

- `aio app deploy` to build and deploy all actions on Runtime and static files to CDN
- `aio app undeploy` to undeploy the app

## Config

### `.env`

You can generate this file using the command `aio app use`. 

After doing the `aio app use` add the the .env file the following config params.  An example can be found in `_dot.env` file found at project root
```bash
# This file must **not** be committed to source control

## please provide your Adobe I/O Runtime credentials
# AIO_RUNTIME_AUTH=
# AIO_RUNTIME_NAMESPACE=
...
IMS_ENDPOINT=https://ims-na1.adobelogin.com
GET_AEM_ASSET_DATA__AEM_USE_PASSED_AUTH=false
## FIREFLY_SERVICES
FIREFLY_SERVICES__USE_PASSED_AUTH=false
FIREFLY_SERVICES_CLIENT_ID=106726fcfcce4123123123123213213
FIREFLY_SERVICES_CLIENT_SECRET=p8e-1G4-tJu3ym11232132131231231n
FIREFLY_SERVICES_SCOPES=firefly_api,ff_apis,openid,AdobeID,session,additional_info,read_organizations
FIREFLY_SERVICES_ORG_ID=33C1401053CF76370A12321312312@AdobeOrg
# New Relic --- if your using new relic to help debug
NEW_RELIC__LICENSE_KEY=7cb0eeeac1f3ce5700e158d12321313123
NEW_RELIC_LOG_LEVEL=debug
NEW_RELIC_ACCOUNT_ID=123123
OPENWHISK_NEWRELIC_DISABLE_METRICS=false  # set to true if you want to pause or turn off metrics
# log for reporting
GENERATE_AUDIT_REPORT_LOG=true  # this will record the audit findings so you can run reports of the total findings
```

### `app.config.yaml`

- Main configuration file that defines an application's implementation. 
- More information on this file, application configuration, and extension configuration 
  can be found [here](https://developer.adobe.com/app-builder/docs/guides/appbuilder-configuration/#appconfigyaml)

## Actions

1. **clearExpressAuditData**: clears out the saved audit results data

2. **get-auth**: Helper function for getting Adobe JWT auth tokens

3. **getAemAssetData**: Helper function that can be called to get AEM Asset data

4. **getAemFileExpressAudit**: Serverless Function that pulls in AEM asset data and the manifest and executes the logic steps to run audit and save the results to Metadata and Comments on the processed asset. 

5. **getAemPresignedUrl**: Serverless Function that will build out a AEM asset presigned url for use with secondary services like Firefly services

6. **getExpressAuditFileData**: Serverless Function that pulls in detailed asset reports saved in the system.  If this was used on a very large asset count like over 2k assets we would want to consider a db.  Saving the reports to files works but will be slow and at some point it will fail. 

7. **getExpressAuditReport**: Serverless Function that pulls looks at the local reporting binary store path and will tally all the files found and output a summary report.

8. **getPhotoshopManifestForPresignedUrl**: Helper Serverless Function that allows for passing of an AEM asset path and having the sysetm do all the steps needed to request a manifest from photoshop api.  It does not handle the response from the psapi. 

9. **onAemProcComplete**: Event handler Serverless Function that you subscribe to Aem on Processing Complete event in the Adobe developer console project.

9. **onPsApiProcComplete**: Event handler Serverless Function that you subscribe to Photoshop Imaging API events in the Adobe developer console project.


## Utils

1. **aemCscUtils.js**: Holds all the AEM related calls.

2. **fireflyCscUtils.js**: Holds all the Firefly Services related calls.

3. **assetReport.js**: Contains all the logic needed for reporting.

4. **utils.js**: Adobe App Builder common utils class.

5. **adobeAuthUtils**: Contains a method for getting jwt auth tokens.


# notes
6-4-2024: updated the auth to a newer Adobe supported lib. Added auth utils module. 
6-19-2024: added a check to the aem proccesing complete handler to make sure the call is for type=aem.assets.asset.processing_completed
