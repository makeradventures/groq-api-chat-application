// File: chat_window.js

console.log(`Port: ${port}`);

// Global variables
let uploadedFiles = [];
let messageInputValue = '';
let dropTimeout = null;
let chatId = null;

// Define event listeners outside of loadChatHistory
document.addEventListener('dragover', (e) => {
  // Prevent default dragover behavior
  e.preventDefault();
});

// Handle file input change event
document.getElementById('file-input').addEventListener('change', (e) => {
  const newFiles = Array.from(e.target.files);
  console.log('New files selected:', newFiles);
  uploadedFiles = uploadedFiles.concat(newFiles);
  updateFileContainer();
});

// Fetch and parse response from server
function fetchAndParseResponse(url, method, body) {
  return new Promise((resolve, reject) => {
    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: body,
    })
      .then(response => {
        console.log('Response:', response);
        const reader = response.body.getReader();
        const readChunk = () => {
          reader.read().then(({ done, value }) => {
            if (done) {
              console.log('Response finished');
              resolve();
            } else {
              const chunk = new TextDecoder('utf-8').decode(value);
              console.log('Received chunk:', chunk);
              if (chunk.split('}').length > 2) {
                const jsonObjects = chunk.split('}{');
                jsonObjects.forEach((jsonObject, index) => {
                  if (index === 0) {
                    jsonObject = jsonObject + '}';
                  } else if (index === jsonObjects.length - 1) {
                    jsonObject = '{' + jsonObject;
                  } else {
                    jsonObject = '{' + jsonObject + '}';
                  }
                  try {
                    const data = JSON.parse(jsonObject);
                    console.log('Parsed JSON:', data);
                    if (data.reload) {
                      loadChatHistory(chatId); // Reload chat history if 'reload' flag is present
                    }
                  } catch (error) {
                    console.error('Error parsing JSON:', error);
                  }
                });
              } else {
                try {
                  const data = JSON.parse(chunk);
                  console.log('Parsed JSON:', data);
                  if (data.reload) {
                    loadChatHistory(chatId); // Reload chat history if 'reload' flag is present
                  }
                } catch (error) {
                  console.error('Error parsing JSON:', error);
                }
              }
              readChunk();
            }
          });
        };
        readChunk();
      })
      .catch(error => {
        console.error('Error:', error);
        reject(error);
      });
  });
}

// Handle drop event
document.addEventListener('drop', (e) => {
  console.log('Drop event triggered');
  e.preventDefault();
  if (e.dataTransfer && e.dataTransfer.files) {
    if (dropTimeout) clearTimeout(dropTimeout);
    dropTimeout = setTimeout(() => {
      const newFiles = Array.from(e.dataTransfer.files);
      console.log('New files dropped:', newFiles);
      uploadedFiles = uploadedFiles.concat(newFiles);
      updateFileContainer();
    }, 100);
  }
});

// Handle send button click event
document.getElementById('send-button').addEventListener('click', async () => {
  console.log('Send button clicked');
  const messageInput = document.getElementById('message-input');
  messageInputValue = messageInput.value.trim(); // Store the message input value in the global variable
  document.getElementById('message-input').value = ''; // Clear the message input field immediately

  if (messageInputValue || uploadedFiles.length > 0) {
    console.log('Message and/or files detected');
    let additionalContent = {};
    if (uploadedFiles.length > 0) {
      console.log('Files detected, processing...');
      const filePromises = uploadedFiles.map((file, index) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            console.log('File read:', file.name);
            resolve({ filename: `${file.name} ( ${index + 1})`, content: reader.result });
          };
          reader.readAsText(file);
        });
      });
      const fileContents = await Promise.all(filePromises);
      console.log('Promise.all executed');
      fileContents.forEach((fileContent) => {
        additionalContent[fileContent.filename] = fileContent.content;
      });
      // Autofill message if no message is written and files are uploaded
      if (!messageInputValue && uploadedFiles.length > 0) {
        messageInput.value = 'These are the files I wanted to share:';
      }
      // Clear the uploadedFiles array and update the file container here
      uploadedFiles = []; 
      updateFileContainer();
    }
    // Check if chatId is null
    if (chatId === null) {
      // Create a new chat
      const response = await fetch(`http://localhost:${port}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      console.log('New chat created:', data);
      chatId = data.id; // Set chatId to the ID returned by the server
      console.log('About to load chat list...');
      loadChatList(); // Update the chat list element
      // Make a request to the server to log the message
      await fetchAndParseResponse(`http://localhost:${port}/api/chat/${chatId}/message`, 'PATCH', JSON.stringify({ message: messageInputValue, additionalContent }));
      console.log('About to reload chat list after AI response...');
      loadChatList(); // Reload the chat list after the AI response is finished
    } else {
      // Make a request to the server to log the message
      await fetchAndParseResponse(`http://localhost:${port}/api/chat/${chatId}/message`, 'PATCH', JSON.stringify({ message: messageInputValue, additionalContent }));
      console.log('About to reload chat list after AI response...');
      loadChatList(); // Reload the chat list after the AI response is finished
    }
  }
});

// Handle message input keydown event
document.getElementById('message-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById('send-button').click();
  }
});

// Update file container
function updateFileContainer() {
  console.log('Updating file container');
  const fileContainer = document.getElementById('file-container');
  fileContainer.innerHTML = '';

  uploadedFiles.forEach((file, index) => {
    const fileElement = document.createElement('div');
    fileElement.classList.add('file-element');

    // Update the styles of the file element based on the current mode
    if (document.body.classList.contains('light-mode')) {
      fileElement.classList.remove('dark-mode');
    } else {
      fileElement.classList.add('dark-mode');
    }

    fileContainer.appendChild(fileElement);

    const filenameElement = document.createElement('span');
    filenameElement.textContent = `${file.name} (${index + 1})`;
    fileElement.appendChild(filenameElement);

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'X';
    cancelButton.classList.add('cancel-button');

    // Update the styles of the cancel button based on the current mode
    if (document.body.classList.contains('light-mode')) {
      cancelButton.classList.remove('dark-mode');
    } else {
      cancelButton.classList.add('dark-mode');
    }

    fileElement.appendChild(cancelButton);

    cancelButton.addEventListener('click', () => {
      const index = uploadedFiles.indexOf(file);
      if (index !== -1) {
        uploadedFiles.splice(index, 1);
        fileContainer.removeChild(fileElement);
      }
    });
  });
}

// Load chat history
function loadChatHistory(newChatId) {
  if (!newChatId) {
    const chatHistoryContainer = document.getElementById('chat-history-container');
    chatHistoryContainer.innerHTML = '';
    chatId = null; // Update the chatId variable to null
    document.querySelector('.chat-window h2').textContent = 'Chat Window'; // Reset the chat window title
    return;
  }
  chatId = newChatId; // Set the chatId variable to the new chat ID
  fetch(`http://localhost:${port}/api/chat/${newChatId}`)
    .then(response => {
      if (response.status === 404) {
        const chatHistoryContainer = document.getElementById('chat-history-container');
        chatHistoryContainer.innerHTML = '';
        return;
      }
      return response.json();
    })
    .then(data => {
      const chatName = data.name; // Get the chat name from the response data
      document.querySelector('.chat-window h2').textContent = chatName; // Update the chat window title with the chat name

      const chatHistoryHtml = data.messages.map((message, index) => {
        if (message.sender === 'AI') {
          const markdownCode = message.message;
          try {
            const options = {
              gfm: true,
              tables: true,
              breaks: true,
              pedantic: false,
              sanitize: false,
              smartLists: true,
              smartypants: true
            };
            let parsedMarkdown = marked.parse(markdownCode, options);
            const codeElements = parsedMarkdown.match(/```/g);
            let codeBlockCount = 0;
            if (codeElements) {
              codeBlockCount = codeElements.length / 2;
            } else {
              const preElements = parsedMarkdown.match(/<pre>/g);
              if (preElements) {
                codeBlockCount = preElements.length;
              }
            }
            console.log(`Message ${index + 1} contains ${codeBlockCount} code blocks`);
            let currentIndex = [];
            parsedMarkdown = parsedMarkdown.replace(/<pre>/g, () => {
              const id = `code-${currentIndex.length + 1}-${newChatId}-${index}`;
              console.log(`Adding top copy button with id: ${id}`);
              const codeCellHtml = `<div class="code-cell"><button class="copy-button copy-button-top" data-clipboard-target="#${id}">Copy</button><pre id="${id}">`;
              currentIndex.push(id);
              return codeCellHtml;
            });
            parsedMarkdown = parsedMarkdown.replace(/<\/pre>/g, () => {
              const id = currentIndex.shift();
              console.log(`Adding bottom copy button with id: ${id}`);
              return `</pre><button class="copy-button copy-button-bottom" data-clipboard-target="#${id}">Copy</button></div>`;
            });
            return `<div class="message-bubble ai-message"><p><strong>${message.sender}:</strong> ${parsedMarkdown}</p></div>`;
          } catch (error) {
            console.error('Error parsing markdown:', error);
            return `<div class="message-bubble ai-message"><p><strong>${message.sender}:</strong> ${markdownCode}</p></div>`;
          }
        } else {
          console.log(`Message ${index + 1} contains 0 code blocks`);
          const messageContainer = document.createElement('div');
          messageContainer.innerText = message.message;

          if (message.additional_content) {
            const downloadButtonsContainer = document.createElement('div');
            downloadButtonsContainer.style.display = 'flex';
            downloadButtonsContainer.style.flexWrap = 'wrap';
            downloadButtonsContainer.style.gap = '10px';
            Object.keys(message.additional_content).forEach((filename, index) => {
              const content = message.additional_content[filename];
              const downloadButton = document.createElement('button');
              downloadButton.classList.add('download-button');
              downloadButton.setAttribute('data-filename', filename);
              downloadButton.textContent = `Download ${filename}`;
              downloadButtonsContainer.appendChild(downloadButton);
              if (index === 0) {
                const br1 = document.createElement('br');
                const br2 = document.createElement('br');
                messageContainer.appendChild(br1);
                messageContainer.appendChild(br2);
              }
              messageContainer.appendChild(downloadButtonsContainer);
              window.additionalContent = window.additionalContent || {};
              window.additionalContent[filename] = content;
            });
          }

          return `<div class="message-bubble user-message"><p><strong>${message.sender}:</strong> ${messageContainer.outerHTML}</p></div>`;
        }
      }).join('');
      const chatHistoryContainer = document.getElementById('chat-history-container');
      chatHistoryContainer.innerHTML = chatHistoryHtml;

      // Create a new ClipboardJS instance for each message
      const messages = chatHistoryContainer.querySelectorAll('.message-bubble.ai-message');
      messages.forEach((message) => {
        const copyButtons = message.querySelectorAll('.copy-button');
        copyButtons.forEach((button) => {
          new ClipboardJS(button);
        });
      });

      // Add event listener for download buttons
      const downloadButtons = chatHistoryContainer.querySelectorAll('.download-button');
      downloadButtons.forEach(button => {
        button.addEventListener('click', () => {
          const filename = button.getAttribute('data-filename');
          const content = window.additionalContent[filename];
          const blob = new Blob([content], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
        });
      });
    })
    .catch(error => console.error('Error:', error));
}
