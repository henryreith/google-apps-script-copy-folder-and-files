// Configuration
const CONFIG = {
  API_KEY: 'API_KEY' // Replace with your actual API key
};

/**
 * Copies a folder structure and its contents
 * @param {string} sourceFolderId - The ID of the source folder in Google Drive
 * @param {string} destinationFolderId - The ID of the destination folder in Google Drive
 * @param {string} newFolderName - The name for the new main folder (optional)
 * @returns {string} JSON string containing the copy results
 */
function copyFolderStructure(sourceFolderId, destinationFolderId, newFolderName) {
  var startTime = new Date();
  var success = true;
  var errors = [];
  var totalFiles = 0;
  var totalSize = 0;
  var folderIdMap = {};
  var createdFiles = [];

  try {
    var sourceFolder = DriveApp.getFolderById(sourceFolderId);
    var destinationFolder = DriveApp.getFolderById(destinationFolderId);

    // Determine the main folder name
    var mainFolderName = newFolderName || sourceFolder.getName();

    // Ensure the folder name is unique
    mainFolderName = getUniqueFolderName(destinationFolder, mainFolderName);

    var newFolder = destinationFolder.createFolder(mainFolderName);
    var mainFolderId = newFolder.getId();

    // Create folder structure
    var folderStructure = {
      name: mainFolderName,
      id: mainFolderId,
      url: newFolder.getUrl(),
      subFolders: {},
      files: {}
    };
    folderIdMap[mainFolderId] = folderStructure;

    createFolderStructure(sourceFolder, newFolder, folderStructure, folderIdMap);

    // Copy files
    copyFiles(sourceFolder, newFolder, folderStructure, folderIdMap, createdFiles);

    // Calculate total files and size
    totalFiles = createdFiles.length;
    totalSize = createdFiles.reduce((sum, file) => sum + file.size, 0);

  } catch (error) {
    success = false;
    errors.push(error.toString());
    console.error("Error in copyFolderStructure: " + error);
  }

  // Prepare return data
  var returnData = {
    success: success,
    timestamp: startTime.toISOString(),
    mainFolder: {
      name: mainFolderName,
      id: mainFolderId,
      url: newFolder.getUrl()
    },
    summary: {
      totalFiles: totalFiles,
      totalSize: totalSize,
      folderCount: Object.keys(folderIdMap).length
    },
    folderStructure: folderStructure,
    errors: errors
  };

  // Return the result as a JSON string
  return JSON.stringify(returnData);
}

function createFolderStructure(sourceFolder, destinationFolder, currentStructure, folderIdMap) {
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
    createFolderStructure(subfolder, newSubfolder, newStructureNode, folderIdMap);
  }
}

function copyFiles(sourceFolder, destinationFolder, currentStructure, folderIdMap, createdFiles) {
  var files = sourceFolder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
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
  }
  
  var subfolders = sourceFolder.getFolders();
  while (subfolders.hasNext()) {
    var subfolder = subfolders.next();
    var destSubfolder = destinationFolder.getFoldersByName(subfolder.getName()).next();
    var subStructure = currentStructure.subFolders[destSubfolder.getName()];
    copyFiles(subfolder, destSubfolder, subStructure, folderIdMap, createdFiles);
  }
}

function getFilePath(folder, folderIdMap) {
  var path = [];
  var currentFolder = folder;
  while (currentFolder.getParents().hasNext()) {
    var parentFolder = currentFolder.getParents().next();
    var folderInfo = folderIdMap[currentFolder.getId()];
    if (folderInfo) {
      path.unshift(currentFolder.getName());
    }
    currentFolder = parentFolder;
  }
  return path.join('/');
}

function getUniqueFolderName(parentFolder, baseName) {
  var name = baseName;
  var counter = 1;
  while (parentFolder.getFoldersByName(name).hasNext()) {
    name = baseName + ' (' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MMM-yyyy HH:mm:ss") + ')';
    counter++;
  }
  return name;
}

/* -- Security -- */
// Helper Functions

function checkRateLimit() {
  var cache = CacheService.getScriptCache();
  var key = 'lastExecution_' + Session.getActiveUser().getEmail();
  var lastExecution = cache.get(key);
  var now = new Date().getTime();
  if (lastExecution && now - parseInt(lastExecution) < 1000) { // 1 second limit
    throw new Error('Rate limit exceeded');
  }
  cache.put(key, now.toString(), 60); // Store for 60 seconds
}

function validateInput(sourceFolderId, destinationFolderId) {
  if (!/^[a-zA-Z0-9-_]+$/.test(sourceFolderId) || !/^[a-zA-Z0-9-_]+$/.test(destinationFolderId)) {
    throw new Error('Invalid input format');
  }
}

function verifyFolderAccess(folderId) {
  try {
    DriveApp.getFolderById(folderId);
  } catch (e) {
    throw new Error('No access to folder or folder does not exist: ' + folderId);
  }
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    // Parse the incoming JSON data
    var params = e.postData ? JSON.parse(e.postData.contents) : e.parameter;
    
    // API Key Authentication
    if (params.apiKey !== CONFIG.API_KEY) {
      throw new Error('Unauthorized');
    }
    
    // Rate Limiting
    checkRateLimit();
    
    // Input Validation
    var sourceFolderId = params.sourceFolderId;
    var destinationFolderId = params.destinationFolderId;
    var newFolderName = params.newFolderName;
    
    if (!sourceFolderId || !destinationFolderId) {
      throw new Error('Missing required parameters');
    }
    
    validateInput(sourceFolderId, destinationFolderId);
    
    // Folder Access Verification
    verifyFolderAccess(sourceFolderId);
    verifyFolderAccess(destinationFolderId);

    console.log('Execution started for user: ' + Session.getActiveUser().getEmail());
    
    // Main Function Execution
    var result = copyFolderStructure(sourceFolderId, destinationFolderId, newFolderName);
    
    // Return Result
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: JSON.parse(result)
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // Return Error
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Test function to run the main function with specific IDs
 */
/*
function testCopyFolderStructure() {
  var sourceFolderId = '1c_AZq6-fnedwfdsfd'; // Your source folder
  var destinationFolderId = '1Vu5a2dcdscd'; // Your destination folder
  var newFolderName = '[] New Folder'; // Optional: set to null to use source folder name
  var result = copyFolderStructure(sourceFolderId, destinationFolderId, newFolderName);
  Logger.log(result);
} 
*/
