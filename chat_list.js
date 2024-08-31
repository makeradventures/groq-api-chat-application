// Get the query parameter
const urlParams = new URLSearchParams(window.location.search);
const port = urlParams.get('port');

console.log(`Port: ${port}`);

// Variable to store the ID of the newly created chat
let newlyCreatedChatId = null;

// Attach event listener to chat list items
const chatListUl = document.getElementById('chat-list-ul');
chatListUl.addEventListener('click', (event) => {
  // Check if the clicked element is a chat info item
  if (event.target.classList.contains('chat-info')) {
    const chatId = event.target.parentNode.getAttribute('data-id');
    loadChatHistory(chatId);
  } 
  // Check if the clicked element is a parent of a chat info item
  else if (event.target.parentNode.classList.contains('chat-info')) {
    const chatId = event.target.parentNode.parentNode.getAttribute('data-id');
    loadChatHistory(chatId);
  } 
  // Check if the clicked element is a dots item
  else if (event.target.classList.contains('dots')) {
    const dropdownMenu = event.target.parentNode.querySelector('.dropdown-menu');
    const dotRect = event.target.getBoundingClientRect();
    const parentRect = event.target.parentNode.getBoundingClientRect();
    dropdownMenu.style.left = `${parentRect.left}px`;
    dropdownMenu.style.top = `${dotRect.top - parentRect.top + window.scrollY}px`;
    dropdownMenu.style.display = 'block';
  }
});

// Function to load chat list
function loadChatList() {
  console.log("Reloading chat list");
  fetch(`http://localhost:${port}/api/chat-list`)
    .then(response => {
      if (response.ok) {
        return response.json();
      } else {
        console.error('Error loading chat list:', response.status);
        return [];
      }
    })
    .then(data => {
      if (data) {
        const chatListHtml = data.map(chat => {
          const summary = chat.summary ? chat.summary : 'Waiting for AI naming tool';
          const summaryWords = summary.split(' ');
          const abbreviatedWords = summaryWords.map(word => {
            if (word.length > 15) {
              return word.substring(0, 12) + '..';
            }
            return word;
          });
          const summaryPreview = abbreviatedWords.slice(0, 5).join(' ');
          if (abbreviatedWords.length > 5 && !abbreviatedWords[5].match(/[^ ]$/)) {
            summaryPreview = abbreviatedWords.slice(0, 4).join(' ');
          }
          return `<li>
            <div class="chat-item" data-id="${chat.id}">
              <div class="chat-info" style="cursor: pointer;">
                <div class="chat-name">${chat.name}</div>
                <div class="chat-summary">${summaryPreview}</div>
              </div>
              <div class="dots" data-id="${chat.id}">...</div>
              <div class="dropdown-menu" data-id="${chat.id}">
                <button class="rename-button">Rename</button>
                <button class="delete-button">Delete</button>
                <button class="rename-with-ai-button">Rename with deterministic AI</button>
              </div>
            </div>
          </li>`;
        }).join('');
        chatListUl.innerHTML = chatListHtml;
        // Select the newly created chat
        if (newlyCreatedChatId) {
          const newlyCreatedChatItem = chatListUl.querySelector(`.chat-item[data-id="${newlyCreatedChatId}"]`);
          if (newlyCreatedChatItem) {
            loadChatHistory(newlyCreatedChatId);
          }
          newlyCreatedChatId = null;
        }
      } else {
        console.error('Error parsing chat list data:', data);
      }
    })
    .catch(error => console.error('Error loading chat list:', error));
}

// Function to rename a chat
function renameChat(chatId) {
  const chatItem = document.querySelector(`.chat-item[data-id="${chatId}"]`);
  const oldName = chatItem.querySelector('.chat-name').textContent;
  const newName = prompt(`Rename ${oldName} to:`);
  if (newName) {
    fetch(`http://localhost:${port}/api/chat/${chatId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })
      .then(response => response.json())
      .then(data => {
        console.log(data);
        loadChatList();
      })
      .catch(error => console.error('Error:', error));
  }
}

// Function to rename a chat with deterministic AI
function renameChatWithAI(chatId) {
  const chatItem = document.querySelector(`.chat-item[data-id="${chatId}"]`);
  const chatSummary = chatItem.querySelector('.chat-summary');
  chatSummary.textContent = 'Waiting for AI naming tool';

  fetch(`http://localhost:${port}/api/chat/${chatId}/rename-with-ai`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  })
    .then(response => response.json())
    .then(data => {
      console.log(data);
      loadChatList();
    })
    .catch(error => console.error('Error:', error));
}

// Function to delete a chat
function deleteChat(chatId) {
  fetch(`http://localhost:${port}/api/chat/${chatId}`)
    .then(response => response.json())
    .then(data => {
      const chatName = data.name;
      if (confirm(`Are you sure you want to delete the chat "${chatName}"?`)) {
        fetch(`http://localhost:${port}/api/chat/${chatId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        })
          .then(response => response.json())
          .then(data => {
            console.log(data);
            loadChatList();
            // Reload the chat history
            loadChatHistory(null);
          })
          .catch(error => console.error('Error:', error));
      }
    })
    .catch(error => console.error('Error:', error));
}

// Function to load chat history
function loadChatHistory(chatId) {
  fetch(`http://localhost:${port}/api/chat/${chatId}`)
    .then(response => response.json())
    .then(data => {
      console.log(data);
      // Load chat history into the chat window
    })
    .catch(error => console.error('Error:', error));
}

// Function to create a new chat
function createNewChat() {
  fetch(`http://localhost:${port}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
    .then(response => response.json())
    .then(data => {
      console.log(data);
      newlyCreatedChatId = data.id;
      loadChatList();
    })
    .catch(error => console.error('Error:', error));
}

// Add a new button to the chat list
document.getElementById('create-new-chat-button').onclick = createNewChat;

loadChatList();

// Add event listener to dropdown menu
document.addEventListener('click', (event) => {
  // Check if the clicked element is a rename button
  if (event.target.classList.contains('rename-button')) {
    const chatId = event.target.parentNode.parentNode.querySelector('.dots').getAttribute('data-id');
    renameChat(chatId);
    const dropdownMenu = event.target.parentNode;
    dropdownMenu.style.display = 'none';
  } 
  // Check if the clicked element is a delete button
  else if (event.target.classList.contains('delete-button')) {
    const chatId = event.target.parentNode.parentNode.querySelector('.dots').getAttribute('data-id');
    deleteChat(chatId);
    const dropdownMenu = event.target.parentNode;
    dropdownMenu.style.display = 'none';
  } 
  // Check if the clicked element is a rename with AI button
  else if (event.target.classList.contains('rename-with-ai-button')) {
    const chatId = event.target.parentNode.parentNode.querySelector('.dots').getAttribute('data-id');
    renameChatWithAI(chatId);
    const dropdownMenu = event.target.parentNode;
    dropdownMenu.style.display = 'none';
  } 
  // Check if the clicked element is not a dots or dropdown menu
  else if (!event.target.classList.contains('dots') && !event.target.classList.contains('dropdown-menu')) {
    const dropdownMenus = document.querySelectorAll('.dropdown-menu');
    dropdownMenus.forEach((menu) => {
      menu.style.display = 'none';
    });
  }
});
