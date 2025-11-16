/**
 * @file This script creates a Google Apps Script Web App to recursively copy
 * a Google Drive folder, including all subfolders and files. It's designed
 * to be called as an API from automation platforms like Make.com or n8n.
 *
 * It operates in two modes:
 *
 * 1. DEFAULT (SYNC)
 * If called without a 'callbackUrl', it runs synchronously,
 * waits for the copy to finish, and returns the full JSON
 * response. (Max 6 min Google limit)
 *
 * SYNC POST EXAMPLE:
 * {
 * "apiKey": "YOUR_SECRET_KEY",
 * "sourceFolderId": "YOUR_SOURCE_ID",
 * "destinationFolderId": "YOUR_DEST_ID",
 * "newFolderName": "My Sync Copy"
 * }
 *
 * 2. ASYNC MODE
 * If a 'callbackUrl' is provided, it returns a 'jobId'
 * immediately, processes in the background, and sends the
 * final JSON report to your callback URL when done.
 * This solves client-side timeouts (e.g., Make.com & n8n).
 *
 * ASYNC POST EXAMPLE:
 * {
 * "apiKey": "YOUR_SECRET_KEY",
 * "sourceFolderId": "YOUR_SOURCE_ID",
 * "destinationFolderId": "YOUR_DEST_ID",
 * "newFolderName": "My Async Copy",
 * "callbackUrl": "https://hook.make.com/..."
 * }
 */

// --- CONFIGURATION ---

/**
 * NOTE: The API_KEY MUST be set using Script Properties
 * in Project Settings (gear icon) on the left.
 */
const CONFIG = {
  JSON_REPORT_FILENAME: '_folder_structure_report.json',
  SAVE_JSON_REPORT_DEFAULT: true,
  
  // --- Async Job Queue Settings ---
  // Jobs will be stored in CacheService. 6 hours (21600 sec) is max.
  JOB_EXPIRATION_SECONDS: 21600, 
  JOB_QUEUE_PROPERTY_NAME: 'JOB_QUEUE' // Property to store pending job IDs
};

// --- ONE-TIME ASYNC SETUP ---

/**
 * YOU MUST RUN THIS MANUALLY ONE TIME *ONLY IF* you plan to use
 * the asynchronous callback mode.
 * This sets up the 1-minute trigger that processes the job queue.
 */
function runManually_setupTrigger() {
  // Delete any old triggers to avoid duplicates
  var allTriggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < allTriggers.length; i++) {
    if (allTriggers[i].getHandlerFunction() === 'processJobQueue') {
      ScriptApp.deleteTrigger(allTriggers[i]);
    }
  }

  // Create a new trigger that runs 'processJobQueue' every 1 minute.
  ScriptApp.newTrigger('processJobQueue')
    .timeBased()
    .everyMinutes(1)
    .create();

  Logger.log('Successfully created 1-minute trigger for processJobQueue.');
}

/**
 * YOU CAN RUN THIS MANUALLY to remove the 1-minute trigger
 * if you no longer want to use the asynchronous mode.
 */
function runManually_removeTrigger() {
  var allTriggers = ScriptApp.getProjectTriggers();
  var triggerRemoved = false;
  
  for (var i = 0; i < allTriggers.length; i++) {
    if (allTriggers[i].getHandlerFunction() === 'processJobQueue') {
      ScriptApp.deleteTrigger(allTriggers[i]);
      triggerRemoved = true;
      Logger.log('Successfully removed 1-minute trigger for processJobQueue.');
    }
  }
  
  if (!triggerRemoved) {
    Logger.log('No 1-minute trigger found for "processJobQueue".');
  }
}

// --- WEB APP ENDPOINT (API) ---

/**
 * Main entry point for POST requests to the Web App.
 * @param {object} e - The event parameter from the POST request.
 * @returns {GoogleAppsScript.Content.TextOutput} A JSON response.
 */
function doPost(e) {
  try {
    // 1. Parse and Validate Request
    var params = validateRequest(e);
    
    // 2. Check for 'callbackUrl' to decide mode
    if (params.callbackUrl) {
      
      // --- ASYNC MODE ---
      // Job will be processed in the background.
      
      var jobId = Utilities.getUuid();
      
      // Store the job details (including callbackUrl) in the cache
      var jobData = {
        sourceFolderId: params.sourceFolderId,
        destinationFolderId: params.destinationFolderId,
        newFolderName: params.newFolderName,
        saveJsonOutput: params.saveJsonOutput,
        callbackUrl: params.callbackUrl,
        requestTimestamp: new Date().toISOString()
      };
      CacheService.getScriptCache().put(
        'job_' + jobId, 
        JSON.stringify(jobData), 
        CONFIG.JOB_EXPIRATION_SECONDS
      );

      // Add this new job ID to the persistent queue
      addJobToQueue(jobId);

      // Return the success response *immediately*
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        jobId: jobId,
        message: 'Job accepted and queued for processing.'
      })).setMimeType(ContentService.MimeType.JSON);

    } else {
      
      // --- SYNC MODE (DEFAULT) ---
      // Run the job now and return the full result.
      
      console.log('Execution started (Sync Mode) for user: ' + Session.getActiveUser().getEmail());
    
      // --- Main Function Execution ---
      var resultJson = copyFolderStructure(
        params.sourceFolderId, 
        params.destinationFolderId, 
        params.newFolderName, 
        params.saveJsonOutput
      );
      var resultData = JSON.parse(resultJson);

      // --- Return Successful Result ---
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: resultData
      })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (error) {
    // --- Return Error Result ---
    console.error("Error in handleRequest: " + error.message, error.stack);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Validates the incoming API request.
 * @param {object} e The POST event.
 * @returns {object} The parsed and validated parameters.
 */
function validateRequest(e) {
  var params;
  if (e.postData && e.postData.contents) {
    params = JSON.parse(e.postData.contents);
  } else {
    throw new Error('No POST data received.');
  }

  // 1. API Key Authentication
  var scriptProperties = PropertiesService.getScriptProperties();
  var expectedApiKey = scriptProperties.getProperty('API_KEY');
  if (!expectedApiKey) {
    throw new Error('API key has not been set. Please add it to Project Settings > Script Properties.');
  }
  if (params.apiKey !== expectedApiKey) {
    throw new Error('Unauthorized. Invalid API key.');
  }

  // 2. Rate Limiting (if sync)
  if (!params.callbackUrl) {
    checkRateLimit();
  }

  // 3. Validate essential parameters
  var { sourceFolderId, destinationFolderId } = params;
  if (!sourceFolderId || !destinationFolderId) {
    throw new Error('Missing required parameters: sourceFolderId and destinationFolderId.');
  }

  // 4. Validate folder access
  validateInput(sourceFolderId, destinationFolderId);
  verifyFolderAccess(sourceFolderId, 'Source');
  verifyFolderAccess(destinationFolderId, 'Destination');

  // 5. Set saveJsonOutput default
  params.saveJsonOutput = (params.saveJsonOutput !== undefined)
                         ? params.saveJsonOutput
                         : CONFIG.SAVE_JSON_REPORT_DEFAULT;

  return params;
}


// --- BACKGROUND JOB PROCESSING (ASYNC MODE) ---

/**
 * Adds a job ID to the persistent queue (using PropertiesService).
 * This uses LockService to prevent race conditions.
 * @param {string} jobId - The new job ID to add.
 */
function addJobToQueue(jobId) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // Wait up to 30s for lock
    
    var properties = PropertiesService.getScriptProperties();
    var queueJson = properties.getProperty(CONFIG.JOB_QUEUE_PROPERTY_NAME);
    var queue = queueJson ? JSON.parse(queueJson) : [];
    
    queue.push(jobId);
    
    properties.setProperty(CONFIG.JOB_QUEUE_PROPERTY_NAME, JSON.stringify(queue));
    
  } catch (e) {
    console.error('Could not get lock to add job to queue: ' + e.message);
    throw new Error('Failed to queue job, could not acquire lock.');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Gets the next job ID from the queue.
 * This is "atomic" (pops the job and saves the new queue)
 * @returns {string|null} The next job ID, or null if queue is empty.
 */
function getNextJobFromQueue() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    
    var properties = PropertiesService.getScriptProperties();
    var queueJson = properties.getProperty(CONFIG.JOB_QUEUE_PROPERTY_NAME);
    
    if (!queueJson) {
      return null;
    }
    
    var queue = JSON.parse(queueJson);
    if (queue.length === 0) {
      return null;
    }
    
    // Get next job (FIFO - First In, First Out)
    var jobId = queue.shift(); 
    
    properties.setProperty(CONFIG.JOB_QUEUE_PROPERTY_NAME, JSON.stringify(queue));
    
    return jobId;
    
  } catch (e) {
    console.error('Could not get lock to read job queue: ' + e.message);
    return null;
  } finally {
    lock.releaseLock();
  }
}

/**
 * This is the function run by the 1-minute trigger.
 * It checks the queue and processes *one* job.
 */
function processJobQueue() {
  var jobId = getNextJobFromQueue();
  
  if (!jobId) {
    // Logger.log('Job queue is empty. Sleeping.');
    return;
  }

  Logger.log('Found job ' + jobId + '. Starting processing (Async).');
  
  var jobDataStr = CacheService.getScriptCache().get('job_' + jobId);
  if (!jobDataStr) {
    console.error('Job ' + jobId + ' found in queue but data not found in cache. It may have expired. Discarding.');
    return;
  }
  
  var jobData = JSON.parse(jobDataStr);
  var callbackUrl = jobData.callbackUrl;
  
  try {
    // --- Run the *entire* synchronous copy logic ---
    var resultJson = copyFolderStructure(
      jobData.sourceFolderId,
      jobData.destinationFolderId,
      jobData.newFolderName,
      jobData.saveJsonOutput
    );
    // ---
    
    Logger.log('Job ' + jobId + ' completed successfully.');
    
    // Send the successful result to the callback URL
    var responsePayload = {
      success: true,
      jobId: jobId,
      data: JSON.parse(resultJson)
    };
    sendCallback(callbackUrl, responsePayload);

  } catch (e) {
    // The copy job failed!
    console.error('Job ' + jobId + ' FAILED: ' + e.message, e.stack);
    
    // Send the error details to the callback URL
    var errorPayload = {
      success: false,
      jobId: jobId,
      error: 'Job failed during execution: ' + e.message
    };
    sendCallback(callbackUrl, errorPayload);
    
  } finally {
    // Whether it succeeded or failed, remove the job from the cache.
    CacheService.getScriptCache().remove('job_' + jobId);
  }
}

/**
 * Sends the final data (success or error) to the callback URL.
 * @param {string} callbackUrl - The URL to send the POST request to.
 * @param {object} payload - The JSON object to send.
 */
function sendCallback(callbackUrl, payload) {
  try {
    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    };
    
    UrlFetchApp.fetch(callbackUrl, options);
    Logger.log('Successfully sent callback to: ' + callbackUrl);
    
  } catch (e) {
    console.error('FATAL: Could not send callback to ' + callbackUrl + '. Error: ' + e.message);
    // At this point, the job is done but the client (Make/n8n)
    // will never know. This is a potential failure point.
  }
}


// --- CORE COPY LOGIC (Used by Sync and Async) ---

/**
 * Copies a folder structure and its contents recursively.
 * @param {string} sourceFolderId
 * @param {string} destinationFolderId
 * @param {string} [newFolderName]
 * @param {boolean} [saveJsonOutput]
 * @returns {string} JSON string containing the copy results.
 */
function copyFolderStructure(sourceFolderId, destinationFolderId, newFolderName, saveJsonOutput) {
  var startTime = new Date();
  var success = true;
  var errors = [];
  var folderIdMap = {}; // Maps new folder IDs to their node in the structure
  var createdFiles = [];
  var newFolder;
  var mainFolderId;
  var mainFolderName;
  var destinationFolder;

  try {
    var sourceFolder = DriveApp.getFolderById(sourceFolderId);
    destinationFolder = DriveApp.getFolderById(destinationFolderId);
    
    mainFolderName = newFolderName || sourceFolder.getName();
    mainFolderName = getUniqueFolderName(destinationFolder, mainFolderName);

    newFolder = destinationFolder.createFolder(mainFolderName);
    mainFolderId = newFolder.getId();

    var folderStructure = {
      name: mainFolderName,
      id: mainFolderId,
      url: newFolder.getUrl(),
      subFolders: {},
      files: {}
    };
    folderIdMap[mainFolderId] = folderStructure;

    createFolderStructureRecursive(sourceFolder, newFolder, folderStructure, folderIdMap);
    copyFilesRecursive(sourceFolder, newFolder, folderStructure, folderIdMap, createdFiles);

  } catch (error) {
    success = false;
    errors.push(error.toString());
    console.error("Error in copyFolderStructure: " + error.message, error.stack);
  }

  // --- PREPARE RETURN DATA ---
  var totalFiles = createdFiles.length;
  var totalSize = createdFiles.reduce((sum, file) => sum + file.size, 0);

  var returnData = {
    success: success,
    timestamp: startTime.toISOString(),
    destinationRoot: {
      name: destinationFolder ? destinationFolder.getName() : null,
      id: destinationFolderId,
      url: destinationFolder ? destinationFolder.getUrl() : null
    },
    mainFolder: {
      name: mainFolderName,
      id: mainFolderId,
      url: newFolder ? newFolder.getUrl() : null
    },
    summary: {
      totalFiles: totalFiles,
      totalSize: totalSize,
      totalSizeHuman: formatBytes(totalSize),
      folderCount: Object.keys(folderIdMap).length
    },
    folderStructure: folderStructure,
    errors: errors
  };

  // --- SAVE JSON REPORT (FIXED LOGIC) ---
  // This now uses a create-then-update pattern to ensure
  // the JSON file contains its own metadata.
  
  if (saveJsonOutput && newFolder) {
    var reportFile;
    var reportFileInfo;
    
    try {
      var reportFileName = CONFIG.JSON_REPORT_FILENAME;
      
      // 1. Create a placeholder file to get an ID and URL
      reportFile = newFolder.createFile(reportFileName, '{}', 'application/json');
      
      // 2. Get the new report file's info
      reportFileInfo = {
        name: reportFile.getName(),
        id: reportFile.getId(),
        url: reportFile.getUrl(),
        path: getFilePath(newFolder, folderIdMap), // Path will be just the main folder name
        folderId: newFolder.getId(),
        size: 0, // Placeholder size, will update later
        mimeType: reportFile.getMimeType(),
        createdTime: reportFile.getDateCreated().toISOString()
      };
      
      // 3. Add the report's info back into the returnData
      returnData.folderStructure.files[reportFileName] = reportFileInfo;
      createdFiles.push(reportFileInfo); // Add to the flat list
      
      // 4. Recalculate summary to include the (empty) report file
      returnData.summary.totalFiles = createdFiles.length;
      var newTotalSize = createdFiles.reduce((sum, file) => sum + file.size, 0);
      returnData.summary.totalSize = newTotalSize;
      returnData.summary.totalSizeHuman = formatBytes(newTotalSize);
      
      // 5. Now, stringify the *final* data
      var finalJsonContent = JSON.stringify(returnData, null, 2);
      
      // 6. Update the placeholder file with the final content
      reportFile.setContent(finalJsonContent);
      
      // 7. Get the final size and update the returnData one last time
      var finalFileSize = reportFile.getSize();
      returnData.folderStructure.files[reportFileName].size = finalFileSize;
      // Recalculate size *again* with the final file size
      newTotalSize = createdFiles.reduce((sum, file) => {
        return sum + (file.id === reportFile.getId() ? finalFileSize : file.size);
      }, 0);
      returnData.summary.totalSize = newTotalSize;
      returnData.summary.totalSizeHuman = formatBytes(newTotalSize);

    } catch (e) {
      var saveError = "Failed to save JSON report file: " + e.message;
      console.error(saveError);
      returnData.errors.push(saveError);
      returnData.success = false; // Mark success as false if saving the report fails
    }
  }

  // Return the *final* modified JSON string
  return JSON.stringify(returnData, null, 2);
}

/**
 * Recursively creates the folder hierarchy.
 */
function createFolderStructureRecursive(sourceFolder, destinationFolder, currentStructure, folderIdMap) {
  var subfolders = sourceFolder.getFolders();
  while (subfolders.hasNext()) {
    var subfolder = subfolders.next();
    var newSubfolder = destinationFolder.createFolder(subfolder.getName());
    
    var newStructureNode = {
      name: newSubfolder.getName(),
      id: newSubfolder.getId(),
      url: newSubfolder.getUrl(),
      subFolders: {},
      files: {}
    };
    
    currentStructure.subFolders[newSubfolder.getName()] = newStructureNode;
    folderIdMap[newSubfolder.getId()] = newStructureNode;
    
    createFolderStructureRecursive(subfolder, newSubfolder, newStructureNode, folderIdMap);
  }
}

/**
 * Recursively copies files into the new folder structure.
 */
function copyFilesRecursive(sourceFolder, destinationFolder, currentStructure, folderIdMap, createdFiles) {
  var files = sourceFolder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    try {
      var newFile = file.makeCopy(file.getName(), destinationFolder);
      var fileInfo = {
        name: newFile.getName(),
        id: newFile.getId(),
        url: newFile.getUrl(),
        path: getFilePath(destinationFolder, folderIdMap),
        folderId: destinationFolder.getId(),
        size: newFile.getSize(),
        mimeType: newFile.getMimeType(),
        createdTime: newFile.getDateCreated().toISOString()
      };
      
      currentStructure.files[newFile.getName()] = fileInfo;
      createdFiles.push(fileInfo);
    } catch (e) {
      console.error("Could not copy file: " + file.getName() + ", Error: " + e.message);
    }
  }
  
  var subfolders = sourceFolder.getFolders();
  while (subfolders.hasNext()) {
    var subfolder = subfolders.next();
    var destSubfolderIterator = destinationFolder.getFoldersByName(subfolder.getName());
    if (destSubfolderIterator.hasNext()) {
      var destSubfolder = destSubfolderIterator.next();
      var subStructure = currentStructure.subFolders[destSubfolder.getName()];
      copyFilesRecursive(subfolder, destSubfolder, subStructure, folderIdMap, createdFiles);
    } else {
      console.error("Error: Destination subfolder not found: " + subfolder.getName());
    }
  }
}


// --- UTILITY FUNCTIONS ---

/**
 * Gets the relative path of a folder.
 */
function getFilePath(folder, folderIdMap) {
  var path = [];
  var currentFolder = folder;

  // Keep looping as long as we have a folder
  while (currentFolder) {
    var currentId = currentFolder.getId();
    
    // Check if this folder is one we created
    var folderInfo = folderIdMap[currentId];
    
    if (folderInfo) {
      // It's in our map, add its name to the path
      path.unshift(currentFolder.getName());
      
      // Now, find *its* parent *within* our map
      var parents = currentFolder.getParents();
      var parentFoundInMap = false;
      while (parents.hasNext()) {
        var parent = parents.next();
        if (folderIdMap[parent.getId()]) {
          // This is the parent we're looking for
          currentFolder = parent;
          parentFoundInMap = true;
          break; // Exit the inner 'parents' loop
        }
      }
      
      // If we checked all parents and none are in our map,
      // we must be at the root. Stop looping.
      if (!parentFoundInMap) {
        currentFolder = null; 
      }
    } else {
      // This folder (e.g., the destinationFolder) is not in our map.
      // This means we've gone "above" our copied root. Stop.
      currentFolder = null;
    }
  }
  return path.join('/');
}


/**
 * Ensures a unique folder name.
 */
function getUniqueFolderName(parentFolder, baseName) {
  var name = baseName;
  var folders = parentFolder.getFoldersByName(name);
  
  if (folders.hasNext()) {
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MMM-yyyy HH:mm:ss");
    name = baseName + ' (' + timestamp + ')';
    
    var counter = 1;
    folders = parentFolder.getFoldersByName(name);
    while (folders.hasNext()) {
      name = baseName + ' (' + timestamp + ' - ' + counter + ')';
      folders = parentFolder.getFoldersByName(name);
      counter++;
    }
  }
  return name;
}

/**
 * Formats bytes into a human-readable string.
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Checks if the user is making requests too frequently (for sync mode).
 */
function checkRateLimit() {
  var cache = CacheService.getScriptCache();
  var key = 'lastExecution_' + Session.getActiveUser().getEmail();
  var lastExecution = cache.get(key);
  var now = new Date().getTime();
  
  if (lastExecution && now - parseInt(lastExecution) < 1000) { // 1 second limit
    throw new Error('Rate limit exceeded. Please wait a moment and try again.');
  }
  cache.put(key, now.toString(), 60); // Store for 60 seconds
}

/**
 * Validates the format of Google Drive IDs.
 */
function validateInput(sourceFolderId, destinationFolderId) {
  var idRegex = /^[a-zA-Z0-9-_]+$/;
  if (!idRegex.test(sourceFolderId) || !idRegex.test(destinationFolderId)) {
    throw new Error('Invalid input format. Folder IDs should only contain letters, numbers, hyphens, and underscores.');
  }
}

/**
 * Verifies that the script has access to the specified folder.
 */
function verifyFolderAccess(folderId, folderType) {
  try {
    DriveApp.getFolderById(folderId);
  } catch (e) {
    throw new Error(folderType + ' folder not found or access denied: ' + folderId);
  }
}


// --- TEST FUNCTION ---

/**
 * Test function to run the main logic from the Apps Script editor.
 * !! Remember to fill in your test IDs before running !!
 */
/*
function testCopyFolderStructure() {
  var sourceFolderId = 'YOUR_SOURCE_FOLDER_ID';     // <-- ADD ID HERE
  var destinationFolderId = 'YOUR_DEST_FOLDER_ID'; // <-- ADD ID HERE
  var newFolderName = 'My Test Copy Folder';     // Optional: set to null to use source folder name
  
  if (sourceFolderId === 'YOUR_SOURCE_FOLDER_ID' || destinationFolderId === 'YOUR_DEST_FOLDER_ID') {
    Logger.log('Please update the testCopyFolderStructure function with your actual folder IDs before running.');
    return;
  }
  
  Logger.log('Starting test (Sync Mode)...');
  var saveJsonOutput = true; 
  var result = copyFolderStructure(sourceFolderId, destinationFolderId, newFolderName, saveJsonOutput);
  Logger.log(JSON.stringify(JSON.parse(result), null, 2));
  Logger.log('Test complete.');
}
*/
