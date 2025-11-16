# Google Drive Folder/File Copy Google Apps Script 
## How to Copy Entire Google Drive Folders with a Google Apps Script API

This guide explains how to use the `CopyFolderStructure.gs` script to create a powerful API endpoint that can be called from automation platforms like Make.com, n8n, or any other service capable of making HTTP requests.


## The Problem

Automation platforms are great for simple, linear tasks, but they struggle with complex, recursive operations. Trying to copy a Google Drive folder that contains multiple subfolders and a mix of Google Docs, non-Google files (like .zip, .psd, images), and other assets is often impractical. You would need a complex loop of modules that is difficult to build and even harder to maintain.


## The Solution

This Google Apps Script acts as a simple, powerful web app. You send it a POST request with the IDs of the folder to copy and the folder to copy *into*, and it handles all the complex logic on Google's servers.

It recursively:



1. Creates the entire folder structure.
2. Copies every file (Google Docs, binary files, etc.) into its correct new folder.
3. Returns a detailed JSON object containing the IDs, names, and URLs of *all* the newly created folders and files.


## How to Set Up the Script


### 1. Create the Script



1. Go to [script.google.com](https://script.google.com).
2. Click **New project**.
3. Name your project (e.g., "Drive Folder Copier").
4. Delete any code in the Code.gs file.
5. Copy the *entire* contents of CopyFolderStructure.gs and paste it into the editor.


### 2. Set Your API Key



1. In the CONFIG object at the top of the script, change the value of API_KEY.
2. Use a strong, unique, and random string. This is your "password" for the API.
    * **Good Key:** AcbV-!T4q-A$k9-zP!7-qYmR
    * **Bad Key:** my-api-key-123
3. You can use a password generator to create a strong key.
    * [Randon Generator](https://generate-random.org/encryption-keys)
    * [1Password Strong Password Generator](https://1password.com/password-generator/)
4. Click the **Save** icon.


### 3. Deploy as a Web App



1. At the top right, click **Deploy** > **New deployment**.
2. Click the **Select type** (gear) icon and choose **Web app**.
3. In the **Description** field, add a note (e.g., "v1 - Drive Folder Copier").
4. Under **Execute as**, select **Me**. (This is crucial, as it runs the script with *your* permissions).
5. Under **Who has access**, select **Anyone**.
    * **Why "Anyone"?** This step makes the *URL* for the script public, which is necessary so that external services (like Make.com) can send it a request.
    * **How is it secure?** The script's *logic* (in handleRequest) immediately checks for your secret API_KEY. If the key is missing or invalid, the script stops and returns an "Unauthorized" error. This ensures that even though the URL is public, only you (or services you give the key to) can actually *use* it.
6. Click **Deploy**.
7. Google will ask you to **Authorize access**. Click the button and sign in to your account.
8. You will see a "Google hasn't verified this app" screen. This is normal. Click **Advanced**, then click Go to$$Your Project Name$$ \
(unsafe).
9. Review the permissions (it will ask to manage your Drive files) and click **Allow**.
10. Once deployment is complete, you will see a **Web app URL**. **Copy this URL.** This is your new API endpoint.


## How to Call the API (from Make.com, n8n, etc.)

You can now use this URL in any HTTP request module.



* **Method:** POST
* **URL:** [Your Web App URL you just copied]
* **Body Type:** Raw
* **Content Type:** application/json


### Example Request Body:

Provide a JSON object with the following keys.
```json
{ 
  "apiKey": "pa$$wOrd!_123_abc-XYZ", 
  "sourceFolderId": "1c_AZq6de...YOUR_SOURCE_ID...Yq9c", 
  "destinationFolderId": "1Vu5dewd...YOUR_DESTINATION_ID..._b4", 
  "newFolderName": "New Client Project (Copied)", 
  "saveJsonOutput": true 
} 
```



* apiKey: The secret key you set in CONFIG.
* sourceFolderId: The ID of the folder you want to copy.
* destinationFolderId: The ID of the folder you want to copy *into*.
* newFolderName: (Optional) The name for the new folder. If you don't include this, it will use the source folder's name.
* saveJsonOutput: (Optional) Overrides the script's default. Set to true to save the report, false to prevent saving. If you don't send this key, the default from the script's CONFIG.SAVE_JSON_REPORT_DEFAULT will be used. The report is saved as _folder_structure_report.json (this name is also configurable in the script).


## The JSON Response

The script will return a JSON object with a success: true status and a data object. This data object contains a complete map of your new folder, which you can then parse in your automation.


### Full Real-World Example

This example shows the output from copying a template for a "New Podcast Episode," including folders for pre-production, post-production, publishing, etc.
```json
{
  "success": true,
  "timestamp": "2025-11-16T02:58:11.915Z",
  "destinationRoot": {
    "name": "01_Production",
    "id": "1XTz9Fyo5AJ2leCu-yRlDyarUtCv4jh2L",
    "url": "https://drive.google.com/drive/folders/1XTz9Fyo5AJ2leCu-yRlDyarUtCv4jh2L"
  },
  "mainFolder": {
    "name": "New Podcast Episode Example",
    "id": "1D1e5ZSXbWketAEtdJplXy0l8jJ2Gpx4u",
    "url": "https://drive.google.com/drive/folders/1D1e5ZSXbWketAEtdJplXy0l8jJ2Gpx4u"
  },
  "summary": {
    "totalFiles": 17,
    "totalSize": 17,
    "totalSizeHuman": "17 Bytes",
    "folderCount": 49
  },
  "folderStructure": {
    "name": "New Podcast Episode Example",
    "id": "1D1e5ZSXbWketAEtdJplXy0l8jJ2Gpx4u",
    "url": "https://drive.google.com/drive/folders/1D1e5ZSXbWketAEtdJplXy0l8jJ2Gpx4u",
    "subFolders": {
      "06_Archive": {
        "name": "06_Archive",
        "id": "1__YQ8DCAesj21gB_D39iU8ZomBdYDA6R",
        "url": "https://drive.google.com/drive/folders/1__YQ8DCAesj21gB_D39iU8ZomBdYDA6R",
        "subFolders": {
          "Legal": {
            "name": "Legal",
            "id": "1Ywa-j2bJLVj8JK5CgthM2I5f6eOIpWvZ",
            "url": "https://drive.google.com/drive/folders/1Ywa-j2bJLVj8JK5CgthM2I5f6eOIpWvZ",
            "subFolders": {},
            "files": {}
          },
          "Backup": {
            "name": "Backup",
            "id": "1Ta2RGLAKrWwd9eg_VMaMCIwT0mDgwvxs",
            "url": "https://drive.google.com/drive/folders/1Ta2RGLAKrWwd9eg_VMaMCIwT0mDgwvxs",
            "subFolders": {},
            "files": {}
          },
          "Final-Masters": {
            "name": "Final-Masters",
            "id": "1DwIm0xWJEMSnLmSdiPVKBLDdtlgL5Fke",
            "url": "https://drive.google.com/drive/folders/1DwIm0xWJEMSnLmSdiPVKBLDdtlgL5Fke",
            "subFolders": {},
            "files": {}
          }
        },
        "files": {}
      },
      "02_Production": {
        "name": "02_Production",
        "id": "1u1zeUmZQSdqWHux2mS5Rpz9ZM7_dY8va",
        "url": "https://drive.google.com/drive/folders/1u1zeUmZQSdqWHux2mS5Rpz9ZM7_dY8va",
        "subFolders": {
          "Production-Notes": {
            "name": "Production-Notes",
            "id": "1lGBzFB3D5iWuWYu06019OttBDZjjlFxi",
            "url": "https://drive.google.com/drive/folders/1lGBzFB3D5iWuWYu06019OttBDZjjlFxi",
            "subFolders": {},
            "files": {
              "technical_issues": {
                "name": "technical_issues",
                "id": "1_VX5eIceojlWvUArSbxOlq_TljJ6aEbpiinWO-sooaQ",
                "url": "https://docs.google.com/document/d/1_VX5eIceojlWvUArSbxOlq_TljJ6aEbpiinWO-sooaQ/edit?usp=drivesdk",
                "path": "New Podcast Episode Example/02_Production/Production-Notes",
                "folderId": "1lGBzFB3D5iWuWYu06019OttBDZjjlFxi",
                "size": 1,
                "mimeType": "application/vnd.google-apps.document",
                "createdTime": "2025-11-16T02:58:37.415Z"
              },
              "segment_markers": {
                "name": "segment_markers",
                "id": "1TUZjw1J13jDtGwWyqBnMxh2M_FB250UjhMV7vUlh6Rk",
                "url": "https://docs.google.com/spreadsheets/d/1TUZjw1J13jDtGwWyqBnMxh2M_FB250UjhMV7vUlh6Rk/edit?usp=drivesdk",
                "path": "New Podcast Episode Example/02_Production/Production-Notes",
                "folderId": "1lGBzFB3D5iWuWYu06019OttBDZjjlFxi",
                "size": 1,
                "mimeType": "application/vnd.google-apps.spreadsheet",
                "createdTime": "2025-11-16T02:58:39.486Z"
              },
              "recording_log": {
                "name": "recording_log",
                "id": "1pQqwKY9JHb1kbcJAQ_eklIXFx1OZdHuKpQWPCmor-ds",
                "url": "https://docs.google.com/document/d/1pQqwKY9JHb1kbcJAQ_eklIXFx1OZdHuKpQWPCmor-ds/edit?usp=drivesdk",
                "path": "New Podcast Episode Example/02_Production/Production-Notes",
                "folderId": "1lGBzFB3D5iWuWYu06019OttBDZjjlFxi",
                "size": 1,
                "mimeType": "application/vnd.google-apps.document",
                "createdTime": "2025-11-16T02:58:41.707Z"
              }
            }
          },
          "Photos": {
            "name": "Photos",
            "id": "1iMbf6_h3Y-Rov2HEwZTUuXoqQT579nrs",
            "url": "https://drive.google.com/drive/folders/1iMbf6_h3Y-Rov2HEwZTUuXoqQT579nrs",
            "subFolders": {
              "BTS_shots": {
                "name": "BTS_shots",
                "id": "1zoeHLDpdQnvJogB3pxoBArQkL37-JCq4",
                "url": "https://drive.google.com/drive/folders/1zoeHLDpdQnvJogB3pxoBArQkL37-JCq4",
                "subFolders": {},
                "files": {}
              },
              "guest_host_photos": {
                "name": "guest_host_photos",
                "id": "1Xg3DGdfx-ggJqFMfXSK9jFQ4e-ENwWum",
                "url": "https://drive.google.com/drive/folders/1Xg3DGdfx-ggJqFMfXSK9jFQ4e-ENwWum",
                "subFolders": {},
                "files": {}
              }
            },
            "files": {}
          },
          "RAW-Footage": {
            "name": "RAW-Footage",
            "id": "14AAiEOBCvXe6NywbX1Whep1ebyg25GW5",
            "url": "https://drive.google.com/drive/folders/14AAiEOBCvXe6NywbX1Whep1ebyg25GW5",
            "subFolders": {
              "Riverside-Backup": {
                "name": "Riverside-Backup",
                "id": "1HXavaTHCS4-BM_F4v_4LzpFWwfLyWY5o",
                "url": "https://drive.google.com/drive/folders/1HXavaTHCS4-BM_F4v_4LzpFWwfLyWY5o",
                "subFolders": {},
                "files": {}
              },
              "Video": {
                "name": "Video",
                "id": "1Htx8DTj1K-4cNOsKcIK7_bTAJL6aj6bO",
                "url": "https://drive.google.com/drive/folders/1Htx8DTj1K-4cNOsKcIK7_bTAJL6aj6bO",
                "subFolders": {},
                "files": {}
              },
              "Audio": {
                "name": "Audio",
                "id": "1vw2iNQc0VgagsMU8qcYXwEmnFAKhJPyX",
                "url": "https://drive.google.com/drive/folders/1vw2iNQc0VgagsMU8qcYXwEmnFAKhJPyX",
                "subFolders": {},
                "files": {}
              }
            },
            "files": {}
          }
        },
        "files": {}
      },
      "01_Pre-Production": {
        "name": "01_Pre-Production",
        "id": "10j_1_jIGya4A32dXfUvIUTWFzX-CTuDS",
        "url": "https://drive.google.com/drive/folders/10j_1_jIGya4A32dXfUvIUTWFzX-CTuDS",
        "subFolders": {
          "Contracts": {
            "name": "Contracts",
            "id": "1X4yjB5t-yefDi7vzyrHK1LuUv1ghdAIT",
            "url": "https://drive.google.com/drive/folders/1X4yjB5t-yefDi7vzyrHK1LuUv1ghdAIT",
            "subFolders": {},
            "files": {}
          },
          "Show-Notes": {
            "name": "Show-Notes",
            "id": "1IpuaeShELuIrqUPIzBX0j6vXpI7K7vRB",
            "url": "https://drive.google.com/drive/folders/1IpuaeShELuIrqUPIzBX0j6vXpI7K7vRB",
            "subFolders": {
              "draft_versions": {
                "name": "draft_versions",
                "id": "1DdFV0sK7MZDuKz1CO1u3DFsLbRtUsT-P",
                "url": "https://drive.google.com/drive/folders/1DdFV0sK7MZDuKz1CO1u3DFsLbRtUsT-P",
                "subFolders": {},
                "files": {}
              }
            },
            "files": {}
          },
          "Guest-Research": {
            "name": "Guest-Research",
            "id": "1u9SNjCOPcYUmUwtjseSd5rZ88Nz9WZwf",
            "url": "https://drive.google.com/drive/folders/1u9SNjCOPcYUmUwtjseSd5rZ88Nz9WZwf",
            "subFolders": {},
            "files": {
              "Henry's Thoughts / Notes": {
                "name": "Henry's Thoughts / Notes",
                "id": "1JUpgN3paMnW2rH-g9B4VyIGJ3JlF5LKWAx9X5yD55lE",
                "url": "https://docs.google.com/document/d/1JUpgN3paMnW2rH-g9B4VyIGJ3JlF5LKWAx9X5yD55lE/edit?usp=drivesdk",
                "path": "New Podcast Episode Example/01_Pre-Production/Guest-Research",
                "folderId": "1u9SNjCOPcYUmUwtjseSd5rZ88Nz9WZwf",
                "size": 1,
                "mimeType": "application/vnd.google-apps.document",
                "createdTime": "2025-11-16T02:58:47.467Z"
              }
            }
          },
          "Scheduling": {
            "name": "Scheduling",
            "id": "1-osiLrBzAY3b2YxNfwZxEtXt98pnZpXA",
            "url": "https://drive.google.com/drive/folders/1-osiLrBzAY3b2YxNfwZxEtXt98pnZpXA",
            "subFolders": {},
            "files": {}
          }
        },
        "files": {}
      },
      "05_Analytics": {
        "name": "05_Analytics",
        "id": "1prw0KzN6C8x6z15QB2L8x4uMuI6TNe24",
        "url": "https://drive.google.com/drive/folders/1prw0KzN6C8x6z15QB2L8x4uMuI6TNe24",
        "subFolders": {
          "Platform-Stats": {
            "name": "Platform-Stats",
            "id": "1tzLWndSBv-X1pN7nCOYuLkmCTyv3aTUv",
            "url": "https://drive.google.com/drive/folders/1tzLWndSBv-X1pN7nCOYuLkmCTyv3aTUv",
            "subFolders": {},
            "files": {}
          },
          "Social-Performance": {
            "name": "Social-Performance",
            "id": "1dQobVl_1D_u8C4JNW5r2Acyr5QaZBVps",
            "url": "https://drive.google.com/drive/folders/1dQobVl_1D_u8C4JNW5r2Acyr5QaZBVps",
            "subFolders": {},
            "files": {}
          },
          "Reports": {
            "name": "Reports",
            "id": "19GZx0Bbl9ZYpDYQ258vuB21v1CtSgGsG",
            "url": "https://drive.google.com/drive/folders/19GZx0Bbl9ZYpDYQ258vuB21v1CtSgGsG",
            "subFolders": {},
            "files": {}
          }
        },
        "files": {}
      },
      "03_Post-Production": {
        "name": "03_Post-Production",
        "id": "1y_nGiatoR2CuquzOQpLfuj5JSV9YAJ8K",
        "url": "https://drive.google.com/drive/folders/1y_nGiatoR2CuquzOQpLfuj5JSV9YAJ8K",
        "subFolders": {
          "Transcripts": {
            "name": "Transcripts",
            "id": "1l_k1uwRv9rFQLdkI0xmZns1HN5VnsDop",
            "url": "https://drive.google.com/drive/folders/1l_k1uwRv9rFQLdkI0xmZns1HN5VnsDop",
            "subFolders": {},
            "files": {
              "transcript_edited": {
                "name": "transcript_edited",
                "id": "1irJNd5sOBsEtEpzNMPvry8uFstTITw73xATaBWbE6WU",
                "url": "https://docs.google.com/document/d/1irJNd5sOBsEtEpzNMPvry8uFstTITw73xATaBWbE6WU/edit?usp=drivesdk",
                "path": "New Podcast Episode Example/03_Post-Production/Transcripts",
                "folderId": "1l_k1uwRv9rFQLdkI0xmZns1HN5VnsDop",
                "size": 1,
                "mimeType": "application/vnd.google-apps.document",
                "createdTime": "2025-11-16T02:58:52.022Z"
              },
              "timestamps": {
                "name": "timestamps",
                "id": "1sco8q7zPKEpiRKfxrNSP4pfdjKQ2RkyhisQQ3r0RERE",
                "url": "https://docs.google.com/spreadsheets/d/1sco8q7zPKEpiRKfxrNSP4pfdjKQ2RkyhisQQ3r0RERE/edit?usp=drivesdk",
                "path": "New Podcast Episode Example/03_Post-Production/Transcripts",
                "folderId": "1l_k1uwRv9rFQLdkI0xmZns1HN5VnsDop",
                "size": 1,
                "mimeType": "application/vnd.google-apps.spreadsheet",
                "createdTime": "2025-11-16T02:58:54.725Z"
              },
              "full_transcript_raw": {
                "name": "full_transcript_raw",
                "id": "1k_tUbRcbX_MOqWT_aze5RoSPEU9N1SpI998LNQh5Qds",
                "url": "https://docs.google.com/document/d/1k_tUbRcbX_MOqWT_aze5RoSPEU9N1SpI998LNQh5Qds/edit?usp=drivesdk",
                "path": "New Podcast Episode Example/03_Post-Production/Transcripts",
                "folderId": "1l_k1uwRv9rFQLdkI0xmZns1HN5VnsDop",
                "size": 1,
                "mimeType": "application/vnd.google-apps.document",
                "createdTime": "2025-11-16T02:58:56.384Z"
              }
            }
          },
          "Project-Files": {
            "name": "Project-Files",
            "id": "1GtunAefH4VqDi3fSrbx2xk89fzp_4s8r",
            "url": "https://drive.google.com/drive/folders/1GtunAefH4VqDi3fSrbx2xk89fzp_4s8r",
            "subFolders": {
              "Auto-Saves": {
                "name": "Auto-Saves",
                "id": "14ozShIV7x0ql-AY54b1j2DiVqDwPstZv",
                "url": "https://drive.google.com/drive/folders/14ozShIV7x0ql-AY54b1j2DiVqDwPstZv",
                "subFolders": {},
                "files": {}
              }
            },
            "files": {}
          },
          "Exports": {
            "name": "Exports",
            "id": "1UlOVbkOHvNTpR6_iuQLdEHBHUOA8Req5",
            "url": "https://drive.google.com/drive/folders/1UlOVbkOHvNTpR6_iuQLdEHBHUOA8Req5",
            "subFolders": {
              "Clips": {
                "name": "Clips",
                "id": "1PE287vQ0Q9tQ1vYpPP1jnmM88pLukRqU",
                "url": "https://drive.google.com/drive/folders/1PE287vQ0Q9tQ1vYpPP1jnmM88pLukRqU",
                "subFolders": {
                  "Horizontal-Clips": {
                    "name": "Horizontal-Clips",
                    "id": "1NwZY1kVcHvnQef-OalxtfAx2WYTDUq5J",
                    "url": "https://drive.google.com/drive/folders/1NwZY1kVcHvnQef-OalxtfAx2WYTDUq5J",
                    "subFolders": {},
                    "files": {}
                  },
                  "Vertical-Clips": {
                    "name": "Vertical-Clips",
                    "id": "1Vo4ZvAx8Mg_KXF3PAb0ti-Xeqw214L5u",
                    "url": "https://drive.google.com/drive/folders/1Vo4ZvAx8Mg_KXF3PAb0ti-Xeqw214L5u",
                    "subFolders": {},
                    "files": {}
                  },
                  "Square-Clips": {
                    "name": "Square-Clips",
                    "id": "1c963Qo58Dd-PmFyc6_BGMTXBfNhaP-MA",
                    "url": "https://drive.google.com/drive/folders/1c963Qo58Dd-PmFyc6_BGMTXBfNhaP-MA",
                    "subFolders": {},
                    "files": {}
                  }
                },
                "files": {}
              },
              "Audio-Clips": {
                "name": "Audio-Clips",
                "id": "1Cfw_JDKZzra9guDhu0vDLha8Mjtsoohv",
                "url": "https://drive.google.com/drive/folders/1Cfw_JDKZzra9guDhu0vDLha8Mjtsoohv",
                "subFolders": {
                  "audiogram_clips": {
                    "name": "audiogram_clips",
                    "id": "10pmOzQ679mpCFIgniOWsPEPBhef5nGLk",
                    "url": "https://drive.google.com/drive/folders/10pmOzQ679mpCFIgniOWsPEPBhef5nGLk",
                    "subFolders": {},
                    "files": {}
                  }
                },
                "files": {}
              },
              "Full-Episode": {
                "name": "Full-Episode",
                "id": "1jlkhVBswwjk_JFzB5ipD_2x0Md4z62zC",
                "url": "https://drive.google.com/drive/folders/1jlkhVBswwjk_JFzB5ipD_2x0Md4z62zC",
                "subFolders": {},
                "files": {}
              }
            },
            "files": {}
          },
          "Color-Grade": {
            "name": "Color-Grade",
            "id": "1zQ-x0S0ZpPYuGBGyScDRdGKyOTXrkCSm",
            "url": "https://drive.google.com/drive/folders/1zQ-x0S0ZpPYuGBGyScDRdGKyOTXrkCSm",
            "subFolders": {},
            "files": {}
          },
          "Graphics": {
            "name": "Graphics",
            "id": "1IWDXhq8oF0QC2_E9fStx2E3fDdfb8i0j",
            "url": "https://drive.google.com/drive/folders/1IWDXhq8oF0QC2_E9fStx2E3fDdfb8i0j",
            "subFolders": {
              "quote_cards": {
                "name": "quote_cards",
                "id": "10hXsnW9qXRsINAekqb1X0ekwLcZ5BKnC",
                "url": "https://drive.google.com/drive/folders/10hXsnW9qXRsINAekqb1X0ekwLcZ5BKnC",
                "subFolders": {},
                "files": {}
              }
            },
            "files": {}
          }
        },
        "files": {}
      },
      "04_Publishing": {
        "name": "04_Publishing",
        "id": "1jdzdQBT_HgY3OGmwRrRjZUqqjgle422y",
        "url": "https://drive.google.com/drive/folders/1jdzdQBT_HgY3OGmwRrRjZUqqjgle422y",
        "subFolders": {
          "Descriptions": {
            "name": "Descriptions",
            "id": "1rGeMWQhxyiFy8-py0kn1WOklHj6chcGQ",
            "url": "https://drive.google.com/drive/folders/1rGeMWQhxyiFy8-py0kn1WOklHj6chcGQ",
            "subFolders": {},
            "files": {
              "youtube_description": {
                "name": "youtube_description",
                "id": "1uF1JoHNO6JsPCCkVDXQeik4hlZMellVq9OTUca-g6Bk",
                "url": "https://docs.google.com/document/d/1uF1JoHNO6JsPCCkVDXQeik4hlZMellVq9OTUca-g6Bk/edit?usp=drivesdk",
                "path": "New Podcast Episode Example/04_Publishing/Descriptions",
                "folderId": "1rGeMWQhxyiFy8-py0kn1WOklHj6chcGQ",
                "size": 1,
                "mimeType": "application/vnd.google-apps.document",
                "createdTime": "2025-11-16T02:59:03.059Z"
              },
              "timestamps_chapters": {
                "name": "timestamps_chapters",
                "id": "1qQVVcJKkGXHt9qjD0PScedOjhCHmXV3wKAT0WMHNuoo",
                "url": "https://docs.google.com/document/d/1qQVVcJKkGXHt9qjD0PScedOjhCHmXV3wKAT0WMHNuoo/edit?usp=drivesdk",
                "path": "New Podcast Episode Example/04_Publishing/Descriptions",
                "folderId": "1rGeMWQhxyiFy8-py0kn1WOklHj6chcGQ",
                "size": 1,
                "mimeType": "application/vnd.google-apps.document",
                "createdTime": "2025-11-16T02:59:04.902Z"
              },
              "SEO_keywords": {
                "name": "SEO_keywords",
                "id": "1nYzmZiZH_Vttp5bkAi0DBm4J3kybfE54XPk4yVhjwf4",
                "url": "https://docs.google.com/document/d/1nYzmZiZH_Vttp5bkAi0DBm4J3kybfE54XPk4yVhjwf4/edit?usp=drivesdk",
                "path": "New Podcast Episode Example/04_Publishing/Descriptions",
                "folderId": "1rGeMWQhxyiFy8-py0kn1WOklHj6chcGQ",
                "size": 1,
                "mimeType": "application/vnd.google-apps.document",
                "createdTime": "2025-11-16T02:59:07.033Z"
              },
              "spotify_description": {
                "name": "spotify_description",
                "id": "1moufvC9Ak-EigDNzHBJl5z0v250hGaKxVzcksFVfiCs",
                "url": "https://docs.google.com/document/d/1moufvC9Ak-EigDNzHBJl5z0v250hGaKxVzcksFVfiCs/edit?usp=drivesdk",
                "path": "New Podcast Episode Example/04_Publishing/Descriptions",
                "folderId": "1rGeMWQhxyiFy8-py0kn1WOklHj6chcGQ",
                "size": 1,
                "mimeType": "application/vnd.google-apps.document",
                "createdTime": "2025-11-16T02:59:08.898Z"
              },
              "apple_podcasts": {
                "name": "apple_podcasts",
                "id": "1AK75SH0SX7u_Qglsa3ryPSchvDm0Dalp0FCCOYxWhQo",
                "url": "https://docs.google.com/document/d/1AK75SH0SX7u_Qglsa3ryPSchvDm0Dalp0FCCOYxWhQo/edit?usp=drivesdk",
                "path": "New Podcast Episode Example/04_Publishing/Descriptions",
                "folderId": "1rGeMWQhxyiFy8-py0kn1WOklHj6chcGQ",
                "size": 1,
                "mimeType": "application/vnd.google-apps.document",
                "createdTime": "2025-11-16T02:59:10.812Z"
              }
            }
          },
          "Thumbnails": {
            "name": "Thumbnails",
            "id": "1ZVcwAY-Tzauj5ozlTIzY6o2El0FbzWda",
            "url": "https://drive.google.com/drive/folders/1ZVcwAY-Tzauj5ozlTIzY6o2El0FbzWda",
            "subFolders": {
              "platform_specific": {
                "name": "platform_specific",
                "id": "1qFPKzMPHRLWT7hTV96bmK9tCN3-MKLy6",
                "url": "https://drive.google.com/drive/folders/1qFPKzMPHRLWT7hTV96bmK9tCN3-MKLy6",
                "subFolders": {},
                "files": {}
              }
            },
            "files": {}
          },
          "Email": {
            "name": "Email",
            "id": "1rPVfA5eYm-Iy0Or6KBW9l-ALA_3xhH4r",
            "url": "https://drive.google.com/drive/folders/1rPVfA5eYm-Iy0Or6KBW9l-ALA_3xhH4r",
            "subFolders": {},
            "files": {}
          },
          "Social-Media": {
            "name": "Social-Media",
            "id": "1dAU-rlYCBHIwnR3yn0PLQwl-5JiUn9wK",
            "url": "https://drive.google.com/drive/folders/1dAU-rlYCBHIwnR3yn0PLQwl-5JiUn9wK",
            "subFolders": {
              "Follow-Up": {
                "name": "Follow-Up",
                "id": "15rSH36a5m6GumHi4c4zZc5Wyldv3puzi",
                "url": "https://drive.google.com/drive/folders/15rSH36a5m6GumHi4c4zZc5Wyldv3puzi",
                "subFolders": {},
                "files": {
                  "week_later_best_clip": {
                    "name": "week_later_best_clip",
                    "id": "1NZv-831SVcstnIQFGYe6RBybak_7nlHM6DSbzYf62to",
                    "url": "https://docs.google.com/document/d/1NZv-831SVcstnIQFGYe6RBybak_7nlHM6DSbzYf62to/edit?usp=drivesdk",
                    "path": "New Podcast Episode Example/04_Publishing/Social-Media/Follow-Up",
                    "folderId": "15rSH36a5m6GumHi4c4zZc5Wyldv3puzi",
                    "size": 1,
                    "mimeType": "application/vnd.google-apps.document",
                    "createdTime": "2025-11-16T02:59:14.177Z"
                  },
                  "day_3_promo": {
                    "name": "day_3_promo",
                    "id": "124GARdVvOSFYJxe1oohqZbpwS9JcY6j_Oz77SnEJ9eQ",
                    "url": "https://docs.google.com/document/d/124GARdVvOSFYJxe1oohqZbpwS9JcY6j_Oz77SnEJ9eQ/edit?usp=drivesdk",
                    "path": "New Podcast Episode Example/04_Publishing/Social-Media/Follow-Up",
                    "folderId": "15rSH36a5m6GumHi4c4zZc5Wyldv3puzi",
                    "size": 1,
                    "mimeType": "application/vnd.google-apps.document",
                    "createdTime": "2025-11-16T02:59:16.122Z"
                  }
                }
              },
              "Launch-Day": {
                "name": "Launch-Day",
                "id": "1DKYCD1W_P5LHK52mer8NYMkOx-gC7wme",
                "url": "https://drive.google.com/drive/folders/1DKYCD1W_P5LHK52mer8NYMkOx-gC7wme",
                "subFolders": {
                  "stories_sequence": {
                    "name": "stories_sequence",
                    "id": "1h5qSBwGc1aUP0IPHvTFvvX54_EqBfdGL",
                    "url": "https://drive.google.com/drive/folders/1h5qSBwGc1aUP0IPHvTFvvX54_EqBfdGL",
                    "subFolders": {},
                    "files": {}
                  },
                  "instagram_carousel": {
                    "name": "instagram_carousel",
                    "id": "1RM3yVHcFeU5tpJIUtrgnQ9FsW0jCeowb",
                    "url": "https://drive.google.com/drive/folders/1RM3yVHcFeU5tpJIUtrgnQ9FsW0jCeowb",
                    "subFolders": {},
                    "files": {}
                  }
                },
                "files": {
                  "twitter_thread": {
                    "name": "twitter_thread",
                    "id": "1KgxIaLyxL4CU_f90KBRRluHpa1rgC-2nUQhX-wkQnP4",
                    "url": "https://docs.google.com/document/d/1KgxIaLyxL4CU_f90KBRRluHpa1rgC-2nUQhX-wkQnP4/edit?usp=drivesdk",
                    "path": "New Podcast Episode Example/04_Publishing/Social-Media/Launch-Day",
                    "folderId": "1DKYCD1W_P5LHK52mer8NYMkOx-gC7wme",
                    "size": 1,
                    "mimeType": "application/vnd.google-apps.document",
                    "createdTime": "2025-11-16T02:59:18.575Z"
                  },
                  "linkedin_post": {
                    "name": "linkedin_post",
                    "id": "1IEaB0_pDVV_oAGQe63L1G9h15zFuKDgm4eD1xRPE4iQ",
                    "url": "https://docs.google.com/document/d/1IEaB0_pDVV_oAGQe63L1G9h15zFuKDgm4eD1xRPE4iQ/edit?usp=drivesdk",
                    "path": "New Podcast Episode Example/04_Publishing/Social-Media/Launch-Day",
                    "folderId": "1DKYCD1W_P5LHK52mer8NYMkOx-gC7wme",
                    "size": 1,
                    "mimeType": "application/vnd.google-apps.document",
                    "createdTime": "2025-11-16T02:59:20.485Z"
                  }
                }
              }
            },
            "files": {}
          }
        },
        "files": {}
      }
    },
    "files": {
      "_EPISODE_STATUS": {
        "name": "_EPISODE_STATUS",
        "id": "11CxiEI-msKK483u_wQyKV31iPajoLMxPCXOg45iN6HE",
        "url": "https://docs.google.com/document/d/11CxiEI-msKK483u_wQyKV31iPajoLMxPCXOg45iN6HE/edit?usp=drivesdk",
        "path": "New Podcast Episode Example",
        "folderId": "1D1e5ZSXbWketAEtdJplXy0l8jJ2Gpx4u",
        "size": 1,
        "mimeType": "application/vnd.google-apps.document",
        "createdTime": "2025-11-16T02:58:33.669Z"
      }
    }
  },
  "errors": []
}
```
