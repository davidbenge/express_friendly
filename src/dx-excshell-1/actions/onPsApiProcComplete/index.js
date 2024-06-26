/**
 * onPsApiProcComplete
 * 
 * we subscribe this action to the PS API image call events in Adobe IO developer console.
 *
 * Used to handle the PS Api call request results.  To filter all the calls down to the ones we care about we match the Event JobId 
 * to the JobId response we got from calling the Get Manifest call in the previous step and stored in the App Buidler State store.  
 * Then we invoke a local Action passing in all the needed data to generate the Audit .
 */

const { Core, State, Files, Logger } = require('@adobe/aio-sdk')
const { errorResponse } = require('../utils')
//const openwhisk = require("openwhisk")
const { getPhotoshopManifestForPresignedUrl, sleepCscRequest, runExpressReport } = require('../fireflyCscUtils')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })
  const actionName = 'onPsApiProcComplete'

  try {
    //let ow = openwhisk()

    // 'info' is the default level if not set
    logger.info(`Calling the ${actionName} complete action`)
    let outputContent = {}

    // log parameters, only if params.LOG_LEVEL === 'debug'
    //logger.debug(stringParameters(params))

    // handle IO webhook challenge
    if(params.challenge){
      const response = {
        statusCode: 200,
        body: {challenge: params.challenge}
      }
      return response
    }

    logger.debug(`onPsApiProcComplete got event data ${JSON.stringify(params.event, null, 2)}`)

    //get data from state store
    const psApiJobId = params.event.body.jobId
    const state = await State.init()
    logger.debug(`onPsApiProcComplete checking STATE for jobId ${psApiJobId}`)
    const jobData = await state.get(psApiJobId)
    outputContent.jobId = psApiJobId
    logger.debug(`onPsApiProcComplete JOB DATA ${JSON.stringify(jobData, null, 2)}`)
    
    if(typeof jobData !== 'undefined' && typeof jobData.value !== 'undefined'){
      if(jobData.value.processingComplete !== 'undefined' && jobData.value.processingComplete === false){
        logger.debug(`onPsApiProcComplete got job data ${JSON.stringify(jobData, null, 2)}`)
        // update the counter
        jobData.value.processPassCount = jobData.value.processPassCount + 1 
        state.put(psApiJobId, jobData.value,{ ttl: 18000 }) // update the state with the new pass count

        outputContent.jobData = jobData

        // check to see if we got a manifest or if the request failed
        if(params.event.body.outputs[0].status === 'failed'){
          logger.error(`Failed to get manifest for job ${psApiJobId} for aem asset ${jobData.value.aemHost}${jobData.value.aemAssetPath} retry count is ${jobData.value.processPassCount} ${typeof jobData.value.processPassCount} ${JSON.stringify(params.event.body, null, 2)}`)

          if(jobData.value.processPassCount < 5){
            if(typeof params.event.body.outputs[0].errors.details.reason !== 'undefined' && params.event.body.outputs[0].errors.details.reason === 'Unable to download the assets'){
              // retry the download
              logger.debug(`onPsApiProcComplete retrying ${jobData.value.processPassCount} download for job ${psApiJobId} for aem asset ${jobData.value.aemHost}${jobData.value.aemAssetPath}`)
              await sleepCscRequest(15000) // sleep for 15 seconds
              //Retry ps job
              let submitManifestRequestCallResults
              try {
                logger.debug(`${actionName}:getPhotoshopManifestForPresignedUrl retry number ${jobData.value.processPassCount} for ${assetPresignedUrl}`)
                //debuggerOutput(JSON.stringify(params, null, 2))
                params.throwIoEvent = true //throw an IO event for the manifest job completion
                submitManifestRequestCallResults = await getPhotoshopManifestForPresignedUrl(jobData.value.aemAssetPresignedDownloadPath,params,logger)

                if(submitManifestRequestCallResults === undefined || submitManifestRequestCallResults === null){
                  logger.error(`${actionName}:getPhotoshopManifestForPresignedUrl failure'`)
                  return errorResponse(500, `${actionName}:getPhotoshopManifestForPresignedUrl `, logger)
                }
                logger.debug(`${actionName}:getPhotoshopManifestForPresignedUrl complete ${submitManifestRequestCallResults['_links'].self.href}`)
                logger.debug(JSON.stringify(submitManifestRequestCallResults, null, 2))

              } catch (error) {
                logger.error(`${actionName}:getPhotoshopManifestForPresignedUrl failure`)
                logger.error(JSON.stringify(error))
                return errorResponse(500, `${actionName}:getPhotoshopManifestForPresignedUrl failure`, logger)
              }

              return errorResponse(500, `Failed to get manifest for aem asset ${jobData.value.aemHost}${jobData.value.aemAssetPath} on presigned url ${jobData.value.aemAssetPresignedDownloadPath}`, logger)  
            }else{
              return errorResponse(500, `Failed to get manifest for aem asset ${jobData.value.aemHost}${jobData.value.aemAssetPath} on presigned url ${jobData.value.aemAssetPresignedDownloadPath}`, logger)  
            }
          }else{
            await state.delete(psApiJobId)
            return errorResponse(500, `Failed to get manifest for aem asset on presigned url ${jobData.value.aemAssetPresignedDownloadPath} TOO MANY ATTEMPTS ${jobData.value.processPassCount}`, logger)  
          }
        }

        let invokeParams = {
          "manifest": params.event.body,
          "aemHost":jobData.value.aemHost,
          "aemAssetPath":jobData.value.aemAssetPath,
          "jobSecodaryData":jobData.value

        }
        outputContent = await runExpressReport(invokeParams,params,logger)
        /************
         * start the main processing and express check
         * EVENT EXAMPLE {"event_id":"85c4d017-4cd0-49cc-af05-b2dd9a0e18d2","event":{"body":{"jobId":"00bd53a5-e290-452e-a27a-56c66c805369","outputs":[{"status":"succeeded","layers":[{"id":5,"index":1,"type":"layer","name":"woman","locked":false,"visible":true,"rotate":0,"bounds":{"top":738,"left":1341,"width":3187,"height":3742},"blendOptions":{"opacity":100,"blendMode":"normal"}},{"id":1,"index":0,"type":"backgroundLayer","name":"Background","locked":true,"visible":true,"rotate":0,"blendOptions":{"opacity":100,"blendMode":"normal"}}],"document":{"name":"psd","width":6720,"height":4480,"bitDepth":8,"imageMode":"cmyk","iccProfileName":"SWOP (Coated), 20%, GCR, Medium","photoshopBuild":"Adobe Photoshop Lightroom Classic 12.1 (Macintosh)"}}],"_links":{"self":{"href":"https://image.adobe.io/pie/psdService/status/00bd53a5-e290-452e-a27a-56c66c805369"}}}},"recipient_client_id":"106726fcfcce48928c57b45bb4c920fd"}
         *
         ********/
        /*
        let invokeParams = {
          "manifest": params.event.body,
          "aemHost":jobData.value.aemHost,
          "aemAssetPath":jobData.value.aemAssetPath,
          "jobSecodaryData":jobData.value

        }
        */

        /***
         *  Call the action to get the express audit data
         * 
         * blocking - delay returning until action has finished executing (default: false)
         * result - return function result (obj.response.result) rather than entire API result (default: false)
         * params - JSON object containing parameters for the action being invoked (default: {})
         * name - name of the action to invoke
         */
        /*
        let invokeResult = await ow.actions.invoke({
          name: 'dx-excshell-1/getAemFileExpressAudit', // the name of the action to invoke
          blocking: false, // this is the flag that instructs to execute the worker asynchronous
          result: false,
          params: invokeParams
        });
        */


      }else{
          outputContent.message = `Failed to process event because its already complete`
          logger.debug(`onPsApiProcComplete Failed to process event because its already complete ${JSON.stringify(params.event, null, 2)}`)
      }
    }else{
      outputContent.message = `No Job Data found for ${psApiJobId} in state so no work to do`
      logger.debug(`Failed to get data from state for event ${JSON.stringify(params.event, null, 2)}`)
      logger.info(`Failed to get data from state for event`)
    }

    const response = {
      statusCode: 200,
      body: outputContent
    }

    return response
  } catch (error) {
    // log any server errors
    logger.error(error)
    // return with 500
    return errorResponse(500, 'server error', logger)
  }
}

exports.main = main
