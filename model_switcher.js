// model_switcher.js

console.log(`Port: ${port}`);

/**
 * Function to make a GET request to the API.
 * 
 * @param {string} url - The URL of the API endpoint.
 * @returns {Promise} A promise that resolves with the response data.
 */
function fetchApi(url) {
    return fetch(`http://localhost:${port}${url}`);
}

/**
 * Function to make a PATCH request to the API.
 * 
 * @param {string} url - The URL of the API endpoint.
 * @param {object} data - The data to be sent with the request.
 * @returns {Promise} A promise that resolves with the response data.
 */
function patchApi(url, data) {
    return fetch(`http://localhost:${port}${url}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
    });
}

// Create a container for the model list
const modelSwitcherButton = document.getElementById('model-switcher-button');
const modelListContainer = document.createElement('div');
modelListContainer.classList.add('model-dropdown-menu');
modelListContainer.style.display = 'none';
modelListContainer.style.width = '200px';

// Retrieve the list of available models from the API
fetchApi('/api/models')
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            console.error('Error loading models:', response.status);
            return [];
        }
    })
    .then(models => {
        console.log('Models response:', models);
        if (models.data) {
            // Display the list of models in a dropdown or a list
            modelListContainer.innerHTML = '';
            models.data.forEach(model => {
                const modelOption = document.createElement('li');
                modelOption.textContent = model.id;
                modelOption.addEventListener('click', () => {
                    const selectedModelId = modelOption.textContent;
                    patchApi('/api/model', { modelId: selectedModelId })
                        .then(response => response.json())
                        .then(data => {
                            console.log(data);
                            // Update the model switcher button text
                            modelSwitcherButton.textContent = selectedModelId;
                            modelListContainer.style.display = 'none';
                        })
                        .catch(error => console.error('Error:', error));
                });
                modelListContainer.appendChild(modelOption);
            });
            document.getElementById('mode-switcher-container').appendChild(modelListContainer);
            modelListContainer.style.display = 'block';
            modelListContainer.style.top = modelSwitcherButton.offsetTop + modelSwitcherButton.offsetHeight + 'px';
            modelListContainer.style.left = modelSwitcherButton.offsetLeft + 'px';
        } else {
            console.error('Error parsing models data:', models);
        }
    })
    .catch(error => console.error('Error loading models:', error));

// Retrieve the current model ID from the API
fetchApi('/api/model')
    .then(response => response.json())
    .then(data => {
        // Update the model switcher button text with the current model ID
        modelSwitcherButton.textContent = data.modelId;
    })
    .catch(error => console.error('Error loading current model:', error));

// Add event listener to toggle the model list container
modelSwitcherButton.addEventListener('click', () => {
    if (modelListContainer.style.display === 'block') {
        modelListContainer.style.display = 'none';
    } else {
        modelListContainer.style.display = 'block';
    }
});

// Add event listener to close the dropdown menu when clicking outside
document.addEventListener('click', (event) => {
    if (!modelListContainer.contains(event.target) && event.target !== modelSwitcherButton) {
        modelListContainer.style.display = 'none';
    }
});
