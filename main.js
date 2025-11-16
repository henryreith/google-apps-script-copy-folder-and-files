/**
 * @file This script creates a Google Apps Script Web App to recursively copy
 * a Google Drive folder, including all subfolders and files. It's designed
 * to be called as an API from automation platforms like Make.com or n8n.
 */

// --- CONFIGURATION ---

/**
 * Configuration object for the script.
 */
const CONFIG = {
  /**
   * A secret API key you create. This must be passed in the POST request
   * to authorize the execution.
   */
  API_KEY: 'YOUR_SECRET_API_KEY', // IMPORTANT: Replace with your actual API key

  /**
   * The name for the JSON report file that gets saved in the new folder.
   * The `_` prefix is recommended to make it sort to the top.
   */
  JSON_REPORT_FILENAME: '_folder_structure_report.json',

  /**
   * The default behavior for saving the JSON report.
   * This can be overridden by passing `saveJsonOutput: true` or `saveJsonOutput: false`
   * in the POST request body.
   */
  SAVE_JSON_REPORT_DEFAULT: true
};

// --- MAIN FUNCTION ---

/**
 * Copies a folder structure and its contents recursively.
 *
 * @param {string} sourceFolderId - The ID of the source folder in Google Drive.
 * @param {string} destinationFolderId - The ID of the destination folder to copy into.
 * @param {string} [newFolderName] - The name for the new main folder (optional). If not provided, uses the source folder's name.
 * @param {boolean} [saveJsonOutput] - Whether to save the resulting JSON as a file in the new folder.
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

  // Move destinationFolder to outer scope so we can access it in returnData
  var destinationFolder;

  try {
    var sourceFolder = DriveApp.getFolderById(sourceFolderId);
    destinationFolder = DriveApp.getFolderById(destinationFolderId);
    
    // Determine the main folder name
    mainFolderName = newFolderName || sourceFolder.getName();

    // Ensure the folder name is unique in the destination
    mainFolderName = getUniqueFolderName(destinationFolder, mainFolderName);

    // Create the new root folder
    newFolder = destinationFolder.createFolder(mainFolderName);
    mainFolderId = newFolder.getId();

    // Initialize the folder structure JSON object
    var folderStructure = {
      name: mainFolderName,
      id: mainFolderId,
      url: newFolder.getUrl(),
      subFolders: {},
      files: {}
    };

    // Add the root of the new structure to the map
    folderIdMap[mainFolderId] = folderStructure;

    // Recursively create the rest of the folder structure
    createFolderStructureRecursive(sourceFolder, newFolder, folderStructure, folderIdMap);

    // Recursively copy all files into the new structure
    copyFilesRecursive(sourceFolder, newFolder, folderStructure, folderIdMap, createdFiles);

  } catch (error) {
    success = false;
    errors.push(error.toString());
    console.error("Error in copyFolderStructure: " + error.message, error.stack);
  }

  // --- PREPARE RETURN DATA ---

  // Calculate total files and size
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
    // Optional: A flat list of all created files
    // createdFiles: createdFiles,
    errors: errors
  };

  // Convert to JSON string - R-MOVED FROM HERE

  // --- SAVE JSON REPORT ---
  // We do this *before* the final stringify, so we can capture any save errors
  // in the final returned JSON.
  if (saveJsonOutput && newFolder) {
    try {
      var reportFileName = CONFIG.JSON_REPORT_FILENAME;
      // We stringify the *current* state of the data to save it.
      var jsonForFile = JSON.stringify(returnData, null, 2);
      
      // --- FIX: Use the explicit MIME type string instead of the enum ---
      // newFolder.createFile(reportFileName, jsonForFile, MimeType.JSON);
      newFolder.createFile(reportFileName, jsonForFile, 'application/json');
      // --- End of Fix ---

    } catch (e) {
      var saveError = "Failed to save JSON report file: " + e.message;
      console.error(saveError);
      // Now, add this error to the returnData and set success to false.
      // This error will be included in the JSON *response* returned to the user.
      returnData.errors.push(saveError);
      returnData.success = false;
    }
  }

  // Return the *final* result as a JSON string (which includes any save errors)
  return JSON.stringify(returnData, null, 2);
}

/**
 * Recursively creates the folder hierarchy.
 * @param {GoogleAppsScript.Drive.Folder} sourceFolder - The current source folder.
 * @param {GoogleAppsScript.Drive.Folder} destinationFolder - The corresponding new destination folder.
 * @param {object} currentStructure - The node in the JSON structure for the destinationFolder.
 * @param {object} folderIdMap - The map of new folder IDs to structure nodes.
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
    folderIdMap[newSubfolder.getId()] = newStructureNode; // Add new folder to map
    
    // Recurse into the subfolder
    createFolderStructureRecursive(subfolder, newSubfolder, newStructureNode, folderIdMap);
  }
}

/**
 * Recursively copies files into the new folder structure.
 * @param {GoogleAppsScript.Drive.Folder} sourceFolder - The current source folder.
 * @param {GoogleAppsScript.Drive.Folder} destinationFolder - The corresponding new destination folder.
 * @param {object} currentStructure - The node in the JSON structure for the destinationFolder.
 * @param {object} folderIdMap - The map of new folder IDs to structure nodes.
 * @param {Array} createdFiles - An array to accumulate all created file info.
 */
function copyFilesRecursive(sourceFolder, destinationFolder, currentStructure, folderIdMap, createdFiles) {
  // Copy files in the current folder
  var files = sourceFolder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    try {
      var newFile = file.makeCopy(file.getName(), destinationFolder);
      var fileInfo = {
        name: newFile.getName(),
        id: newFile.getId(),
        url: newFile.getUrl(),
        path: getFilePath(destinationFolder, folderIdMap), // Get relative path
        folderId: destinationFolder.getId(),
        size: newFile.getSize(),
        mimeType: newFile.getMimeType(),
        createdTime: newFile.getDateCreated().toISOString()
      };
      
      currentStructure.files[newFile.getName()] = fileInfo;
      createdFiles.push(fileInfo);
    } catch (e) {
      console.error("Could not copy file: " + file.getName() + ", Error: " + e.message);
      // Optional: Add this error to the main error log
      // errors.push("Failed to copy file: " + file.getName() + " - " + e.message);
    }
  }
  
  // Recurse into subfolders
  var subfolders = sourceFolder.getFolders();
  while (subfolders.hasNext()) {
    var subfolder = subfolders.next();
    // Find the corresponding destination subfolder (which was created in createFolderStructureRecursive)
    var destSubfolderIterator = destinationFolder.getFoldersByName(subfolder.getName());
    if (destSubfolderIterator.hasNext()) {
      var destSubfolder = destSubfolderIterator.next();
      var subStructure = currentStructure.subFolders[destSubfolder.getName()];
      copyFilesRecursive(subfolder, destSubfolder, subStructure, folderIdMap, createdFiles);
    } else {
      console.error("Error: Destination subfolder not found: " + subfolder.getName());
      // This should not happen if createFolderStructureRecursive ran correctly
    }
  }
}

// --- UTILITY FUNCTIONS ---

/**
 * Gets the relative path of a folder within the newly created structure.
 * It traverses up the folder tree, using folderIdMap to know when to
 * stop (i.e., when it's outside the new structure).
 *
 * @param {GoogleAppsScript.Drive.Folder} folder - The folder to get the path for.
 * @param {object} folderIdMap - The map of new folder IDs.
 * @returns {string} The relative path (e.g., "New Root/Subfolder/Images").
 */
function getFilePath(folder, folderIdMap) {
  var path = [];
  var currentFolder = folder;
  
  // Keep traversing up as long as the folder has parents
  while (currentFolder.getParents().hasNext()) {
    // Check if the current folder is one we created
    var folderInfo = folderIdMap[currentFolder.getId()];
    
    if (folderInfo) {
      // If it is, add its name to the beginning of the path
      path.unshift(currentFolder.getName());
    } else {
      // If it's not in the map, we've gone outside the new structure, so stop
      break;
    }
    
    currentFolder = currentFolder.getParents().next();
  }
  return path.join('/');
}

/**
 * Ensures a unique folder name within the parent folder.
 * If baseName exists, it appends a timestamp.
 * If that *still* exists, it adds a counter.
 *
 * @param {GoogleAppsScript.Drive.Folder} parentFolder - The folder to check within.
 * @param {string} baseName - The desired folder name.
 * @returns {string} A unique folder name.
 */
function getUniqueFolderName(parentFolder, baseName) {
  var name = baseName;
  var folders = parentFolder.getFoldersByName(name);
  
  if (folders.hasNext()) {
    // If base name exists, add a timestamp
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MMM-yyyy HH:mm:ss");
    name = baseName + ' (' + timestamp + ')';
    
    // In the highly unlikely event the timestamped one also exists, add a counter
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
 * Formats bytes into a human-readable string (KB, MB, GB).
 * @param {number} bytes - The number of bytes.
 * @returns {string} The formatted size.
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


// --- WEB APP & SECURITY ---

/**
 * Main entry point for POST requests to the Web App.
 * @param {object} e - The event parameter from the POST request.
 * @returns {GoogleAppsScript.Content.TextOutput} A JSON response.
 */
function doPost(e) {
  return handleRequest(e);
}

/**
 * Handles the logic for the web app request.
 * @param {object} e - The event parameter.
 * @returns {GoogleAppsScript.Content.TextOutput} A JSON response.
 */
function handleRequest(e) {
  try {
    // Parse the incoming JSON data
    var params;
    if (e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else {
      throw new Error('No POST data received.');
    }
    
    // 1. API Key Authentication
    if (params.apiKey !== CONFIG.API_KEY) {
      throw new Error('Unauthorized. Invalid API key.');
    }
    
    // 2. Rate Limiting (1 call per second per user)
    checkRateLimit();
    
    // 3. Input Validation
    var sourceFolderId = params.sourceFolderId;
    var destinationFolderId = params.destinationFolderId;
    var newFolderName = params.newFolderName; // This one is optional

    // Check for saveJsonOutput param, otherwise use CONFIG default
    var saveJsonOutput = (params.saveJsonOutput !== undefined)
                         ? params.saveJsonOutput
                         : CONFIG.SAVE_JSON_REPORT_DEFAULT;
    
    if (!sourceFolderId || !destinationFolderId) {
      throw new Error('Missing required parameters: sourceFolderId and destinationFolderId.');
    }
    
    validateInput(sourceFolderId, destinationFolderId);
    
    // 4. Folder Access Verification
    verifyFolderAccess(sourceFolderId, 'Source');
    verifyFolderAccess(destinationFolderId, 'Destination');

    console.log('Execution started for user: ' + Session.getActiveUser().getEmail());
    
    // --- Main Function Execution ---
    var resultJson = copyFolderStructure(sourceFolderId, destinationFolderId, newFolderName, saveJsonOutput);
    var resultData = JSON.parse(resultJson);

    // --- Return Successful Result ---
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: resultData
    })).setMimeType(ContentService.MimeType.JSON);

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
 * Checks if the user is making requests too frequently.
 * @throws {Error} if rate limit is exceeded.
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
 * @param {string} sourceFolderId
 * @param {string} destinationFolderId
 * @throws {Error} if input format is invalid.
 */
function validateInput(sourceFolderId, destinationFolderId) {
  var idRegex = /^[a-zA-Z0-9-_]+$/;
  if (!idRegex.test(sourceFolderId) || !idRegex.test(destinationFolderId)) {
    throw new Error('Invalid input format. Folder IDs should only contain letters, numbers, hyphens, and underscores.');
  }
}

/**
 * Verifies that the script has access to the specified folder.
 * @param {string} folderId - The ID of the folder to check.
 * @param {string} folderType - A label (e.g., "Source") for the error message.
 * @throws {Error} if folder is not accessible.
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
  
  Logger.log('Starting test...');
  // Set 4th param to true/false to test JSON report saving,
  // or leave it out to use the default from CONFIG.
  var saveJsonOutput = true; 
  var result = copyFolderStructure(sourceFolderId, destinationFolderId, newFolderName, saveJsonOutput);
  Logger.log(result);
  Logger.log('Test complete.');
}
*/
