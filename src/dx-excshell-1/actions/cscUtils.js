/* 
* <license header>
*/

/* This file exposes some common CSC related utilities for your actions */

/***
 * Get aem service account token
 * 
 * @param {object} params action input parameters.
 * @param {object} logger logger object
 * 
 * @returns {string} aemAuthToken
 */
async function getAemServiceAccountToken(params,logger){
  const openwhisk = require("openwhisk")
  const { Core, State, Files, Logger } = require('@adobe/aio-sdk')
  let ow = openwhisk()

    //AEM auth key from cache 
    let aemAuthToken
    const state = await State.init()
    const stateAuth = await state.get('aem-auth-key')

    //get from store if it exists
   if(typeof stateAuth === 'undefined' || typeof stateAuth.value === 'undefined' || stateAuth.value === null){
      const invokeParams = {
        "client_id":`${params.AEM_SERVICE_TECH_ACCOUNT_CLIENT_ID}`,
        "technical_account_id":`${params.AEM_SERVICE_TECH_ACCOUNT_ID}`,
        "org_id":`${params.AEM_SERVICE_TECH_ACCOUNT_ORG_ID}`,
        "client_secret":`${params.AEM_SERVICE_TECH_ACCOUNT_CLIENT_SECRET}`,
        "private_key":`${params.AEM_SERVICE_TECH_ACCOUNT_PRIVATE_KEY}`,
        "meta_scopes":`${params.AEM_SERVICE_TECH_ACCOUNT_META_SCOPES}`,
        "private_key_base64":true}
      // call the other get-auth app builder action
      let invokeResult = await ow.actions.invoke({
        name: 'dx-excshell-1/get-auth', // the name of the action to invoke
        blocking: true, // this is the flag that instructs to execute the worker asynchronous
        result: true,
        params: invokeParams
        });

        if(typeof invokeResult.body !== 'undefined' && typeof invokeResult.body.access_token !== 'undefined'){
          // if not reqeust a new one and put it in the store
          aemAuthToken = invokeResult.body.access_token
          await state.put('aem-auth-key', aemAuthToken, { ttl: 79200 }) // -1 for max expiry (365 days), defaults to 86400 (24 hours) 79200 is 22 hours
        }else{
          logger.error("Failed to get AEM auth token")
        }
    }else{
      aemAuthToken = stateAuth.value
    }

    return aemAuthToken
}

/***
 * Get photoshop manifest
 * 
 * @param {string} presignedUrl presigned url to the photoshop file
 * @param {string} psApiClientId photoshop api client id
 * @param {string} psApiAuthToken photoshop api auth token
 * @param {object} logger logger object
 * 
 */
async function getPhotoshopManifest(presignedUrl,psApiClientId,psApiAuthToken,logger){
  const psApiManifestUrl = 'https://image.adobe.io/pie/psdService/documentManifest'
  const psApiManifestBody = {
    "inputs": [
      {
        "storage": "external",
        "href": presignedUrl
      }
    ],
    "options": {
      "thumbnails": {
        "type": "image/jpeg"
      }
    }
  }
}

module.exports = {
  getAemServiceAccountToken
}
