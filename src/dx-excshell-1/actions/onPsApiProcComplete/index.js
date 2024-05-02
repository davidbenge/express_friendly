/*
* <license header>
*/

/**
 * onPsApiProcComplete
 *
 */


const fetch = require('node-fetch')
const { Core, State } = require('@adobe/aio-sdk')
const { errorResponse, getBearerToken, stringParameters, checkMissingRequestInputs } = require('../utils')
const openwhisk = require("openwhisk")

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })
  const actionName = 'onPsApiProcComplete'

  try {
    let ow = openwhisk()

    // 'info' is the default level if not set
    logger.info(`Calling the ${actionName} complete action`)
    let outputContent = {}

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(params))

    // handle IO webhook challenge
    if(params.challenge){
      const response = {
        statusCode: 200,
        body: {challenge: params.challenge}
      }
      return response
    }

    //get data from state store
    const psApiJobId = params.event.body.jobId
    const state = await State.init()
    const jobData = await state.get(psApiJobId)
    outputContent.jobId = psApiJobId

    logger.debug(`onPsApiProcComplete got job data ${JSON.stringify(jobData)}`)

    if(typeof jobData !== 'undefined' && typeof jobData.value !== 'undefined' && jobData.value !== null){
      outputContent.jobData = jobData

      // start the main processing and express check
      // EVENT EXAMPLE {"event_id":"85c4d017-4cd0-49cc-af05-b2dd9a0e18d2","event":{"body":{"jobId":"00bd53a5-e290-452e-a27a-56c66c805369","outputs":[{"status":"succeeded","layers":[{"id":5,"index":1,"type":"layer","name":"woman","locked":false,"visible":true,"rotate":0,"bounds":{"top":738,"left":1341,"width":3187,"height":3742},"blendOptions":{"opacity":100,"blendMode":"normal"}},{"id":1,"index":0,"type":"backgroundLayer","name":"Background","locked":true,"visible":true,"rotate":0,"blendOptions":{"opacity":100,"blendMode":"normal"}}],"document":{"name":"psd","width":6720,"height":4480,"bitDepth":8,"imageMode":"cmyk","iccProfileName":"SWOP (Coated), 20%, GCR, Medium","photoshopBuild":"Adobe Photoshop Lightroom Classic 12.1 (Macintosh)"}}],"_links":{"self":{"href":"https://image.adobe.io/pie/psdService/status/00bd53a5-e290-452e-a27a-56c66c805369"}}}},"recipient_client_id":"106726fcfcce48928c57b45bb4c920fd"}
      let invokeParams = {
        "manifest": params.event.body,
        "aemHost":jobData.value.aemHost,
        "aemAssetPath":jobData.value.aemAssetPath,
        "jobSecodaryData":jobData.value

      }
      let invokeResult = await ow.actions.invoke({
        name: 'dx-excshell-1/getAemFileExpressAudit', // the name of the action to invoke
        blocking: false, // this is the flag that instructs to execute the worker asynchronous
        result: false,
        params: invokeParams
      });
    }else{
      logger.error("Failed to get data from state")
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
