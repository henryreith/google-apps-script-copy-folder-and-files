# Google Drive Folder/File Copy Google Apps Script 

This guide explains how to use this script to create a powerful API endpoint for copying Google Drive folders within Google Drive. It's designed to be called from automation platforms like Make.com, n8n, or any service capable of making HTTP requests.

The script operates in two modes:



1. **Synchronous (Default):** If you call it *without* a callbackUrl, it runs the copy, waits for it to finish, and returns the full JSON response. This is best for smaller template folders where the job finishes in under 60 seconds.
2. **Asynchronous (On-Demand):** If you provide a `callbackUrl` in your request, the script instantly returns a jobId. It then does the work in the background and POSTs the final JSON to your URL when complete. This is the **solution for client timeouts** (e..g, [Make.com](Make.com) or n8n’s module timeout limits).


## The Problem This Solves

This script is a powerful "workaround" for the limitations of no-code automation platforms and manual processes.



* **Solves Manual Repetition:** Replaces the slow, error-prone task of manually finding, right-clicking, and duplicating a project template folder.
* **Solves No-Code Complexity:** A single HTTP call replaces a fragile, complex chain of "Create Folder," "Search," and "Loop" modules in Make/n8n.
* **Solves Brittle Automations:** If your master template changes (e.g., you add a new "Assets" folder), you don't need to change your automation at all. The script simply copies the new structure.
* **Copies *All* File Types:** No-code tools often can't copy non-Google files (like .zip, .psd, or .mp4). This script copies *all* files, including binary assets and Google Docs, preserving them perfectly - so you can prefill sheets, or docs with data in your template folder, and it will be all copied over as is.
* **Provides Instant Feedback:** Instead of needing more "Search" modules to find what you just created, this script returns a complete JSON "map" of all the new folder/file IDs and URLs.
* **Saves the "Map" For You:** The script saves this JSON map as a _folder_structure_report.json file *inside* the new folder, so AI agents or future automations can easily find and understand the folder's contents.
* **Beats Client Timeouts:** The **async mode** (by including a callbackUrl) solves the module timeout limit in services like Make and n8n, allowing you to run copy jobs that take up to 6 minutes.


## How to Set Up the Script


### 1. Create the Script



1. Go to [script.google.com](https://script.google.com) and create a new project (e.g., "Drive Folder Copier").
2. Copy the *entire* contents of `main.gs` and paste it into the editor.


### 2. Set Your API Key (Required)



1. In the script editor, click the **Project Settings** (gear icon) on the left.
2. Scroll down to **Script Properties** and click **Add script property**.
3. Enter API_KEY as the **Property**.
4. Paste your strong, random key as the **Value**. (Use a [password generator](https://1password.com/password-generator/)).
5. Click **Save script properties**.


### 3. Set Up the Async Trigger (Optional)

You **only** need to do this if you plan to use the asynchronous callbackUrl mode.



1. In the script editor, select the function runManually_setupTrigger from the dropdown menu at the top.
2. Click **Run**.
3. This will open the **Authorization** popup. Follow the steps to allow the script to manage triggers for you.
4. This creates the 1-minute background trigger that processes the job queue. If you don't do this, async jobs will be queued but never processed.

**To turn the trigger off:** If you stop using the async mode, you can run the runManually_removeTrigger function from the editor to delete this trigger.


### 4. Deploy as a Web App



1. At the top right, click **Deploy** > **New deployment**.
2. Click the **Select type** (gear) icon and choose **Web app**.
3. In the **Description** field, add a note (e.g., "v1 - Drive Folder Copier").
4. Under **Execute as**, select **Me**. (This is crucial, as it runs with *your* permissions).
5. Under **Who has access**, select **Anyone**.
    * **This is secure!** The URL is public, but the script logic checks for your secret API_KEY on every request.
6. Click **Deploy**.
7. Google will ask you to **Authorize access**. Click the button, sign in, click **Advanced**, and then click "Go to [Your Project Name] (unsafe)".
8. Review the permissions and click **Allow**.
9. **Copy the Web app URL.** This is your new API endpoint.


## How to Call the API

You now have two ways to call the *same* URL.


### Mode 1: Synchronous (Default)

Use this for fast jobs (under 60 seconds). The automation will wait for the response.



* **Method:** POST
* **URL:** [Your Web App URL]
* **Content Type:** application/json


#### Request Body:
```json
{ 
  "apiKey": "pa$$wOrd!_123_abc-XYZ", 
  "sourceFolderId": "1c_AZq6de...YOUR_SOURCE_ID...Yq9c", 
  "destinationFolderId": "1Vu5dewd...YOUR_DESTINATION_ID..._b4", 
  "newFolderName": "New Client Project (Sync)", 
  "saveJsonOutput": true 
} 
```


#### Response:

The script will run for up to 6 minutes, then return the full report.

```json
{ 
  "success": true, 
  "data": { 
    "success": true, 
    "timestamp": "2025-11-16T04:35:43.123Z", 
    "destinationRoot": { 
      "name": "01_Production", 
      "id": "1XTz9Fyo5AJ2leCu-yRlDyarUtCv4jh2L", 
      "url": "[https://drive.google.com/drive/folders/1XTz9Fyo5AJ2leCu-yRlDyarUtCv4jh2L](https://drive.google.com/drive/folders/1XTz9Fyo5AJ2leCu-yRlDyarUtCv4jh2L)" 
    }, 
    "mainFolder": { 
      "name": "My Test Copy Folder", 
      "id": "1zgoif-dYoLTImksXjmSqoqIN2cRPwF44", 
      "url": "[https://drive.google.com/drive/folders/1zgoif-dYoLTImksXjmSqoqIN2cRPwF44](https://drive.google.com/drive/folders/1zgoif-dYoLTImksXjmSqoqIN2cRPwF44)" 
    }, 
    "summary": { ... }, 
    "folderStructure": { ... }, 
    "errors": [] 
  } 
} 
```


### Mode 2: Asynchronous (To Beat Timeouts)

Use this for large jobs. The automation will *not* wait.



* **Method:** POST
* **URL:** [Your Web App URL]
* **Content Type:** application/json


#### Request Body (with callbackUrl):
```json
{ 
  "apiKey": "pa$$wOrd!_123_abc-XYZ", 
  "sourceFolderId": "1c_AZq6de...YOUR_SOURCE_ID...Yq9c", 
  "destinationFolderId": "1Vu5dewd...YOUR_DESTINATION_ID..._b4", 
  "newFolderName": "New Async Project", 
  "saveJsonOutput": true, 
  "callbackUrl": "[https://hook.make.com/your-unique-webhook-id](https://hook.make.com/your-unique-webhook-id)" 
} 
```


#### Immediate Response (Step A):

The API will **immediately** (in &lt; 1 sec) respond with this:
```json
{ 
  "success": true, 
  "jobId": "a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8", 
  "message": "Job accepted and queued for processing." 
} 
```


#### Webhook Data (Step B):

Your automation (Make/n8n) will get this response at its webhook URL 1-6 minutes later, when the job is done.
```json
{ 
  "success": true, 
  "jobId": "a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8", 
  "data": { 
    "success": true, 
    "timestamp": "2025-11-16T04:40:15.456Z", 
    "destinationRoot": { ... }, 
    "mainFolder": { ... }, 
    "summary": { ... }, 
    "folderStructure": { ... }, 
    "errors": [] 
  } 
} 
```


## API Error Responses


#### On Failure:

If *any* request fails (sync or async), you'll get this:
```json
{ 
  "success": false, 
  "error": "Unauthorized. Invalid API key." 
} 
```

Or for an async job that fails in the background, your webhook will receive:
```json
{ 
  "success": false, 
  "jobId": "a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8", 
  "error": "Job failed during execution: Source folder not found or access denied..." 
} 
```


## Limitations



* **Google Execution Time (6 Minutes):** This script runs as *you*, so it has a **6-minute execution limit**. This is for *both* sync and async modes. If you are copying thousands of files or very large video files, the job may time out.
* **Client Timeouts (Solved):** The async mode solves the *client-side* (Make/n8n) timeout, but not the 6-minute *Google* timeout.
* **Quota:** This script uses your Google Drive API quota. For most users, this is not an issue, but if you run it thousands of times a day, you may hit a limit.
* **Trigger Runtime:** The (optional) 1-minute trigger uses ~25 minutes of your daily "Trigger runtime" quota, which is well within the 90-minute limit for free accounts.
