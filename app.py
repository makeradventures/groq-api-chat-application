from flask import Flask, jsonify, request, Response
from flask_cors import CORS
from datetime import datetime
import json
import os
import threading
from groq import Groq
import time
import requests
import webbrowser

PORT = 5002
# Set up the client with your API key
client = Groq(api_key=os.environ["GROQ_API_KEY"])

# Define the initial message
initial_message = [
    {
        "role": "system",
        "content": "You are a helpful assistant. Answer questions and provide information."
    }
]

app = Flask(__name__)
CORS(app)

# Load chat history from JSON file
def load_chat_history():
    with open('chat_history.json') as f:
        return json.load(f)

# Load chat history once when the app starts
chat_history = load_chat_history()

# Function to generate chat name and summary
def generate_chat_name_and_summary(messages):
    # Create a prompt to send to the AI
    prompt = "Please summarize and name this chat based on the following conversation:\n\n"
    for message in messages:
        if 'additional_content' in message and message['additional_content'] is not None:
            additional_content = '\n'.join([f"{filename}: {content}" for filename, content in message['additional_content'].items()])
            prompt += f"{message['sender']}: {message['message']}\n{additional_content}\n"
        else:
            prompt += f"{message['sender']}: {message['message']}\n"
    prompt += "\nPlease respond with a JSON object containing the chat name and a summary of the conversation, separated by a newline character. The summary should be no more than 5 words. For example: {\"name\": \"Chat Name\", \"summary\": \"Short summary\"}\n"
    prompt += "Your response should work correctly with this python code: response_json = json.loads(response)\n"
    
    # Create a list of messages to send to the Groq API
    messages = initial_message + [
        {
            "role": "user",
            "content": prompt
        }
    ]
    try:
        chat_completion = client.chat.completions.create(
            messages=messages,
            model=model_id,
            temperature=0,
            max_tokens=4096,
            stream=False
        )
        if chat_completion.choices:
            response = chat_completion.choices[0].message.content
            try:
                # Extract the JSON object from the response
                start_index = response.find('{')
                end_index = response.rfind('}') + 1
                response_json = json.loads(response[start_index:end_index])
                chat_name = response_json["name"]
                chat_summary = response_json["summary"]
                return chat_name, chat_summary
            except json.JSONDecodeError:
                return None, "AI naming tool failed"
        else:
            return None, "AI naming tool failed"
    except Exception as e:
        return None, "AI naming tool failed"
       
# Load models once when the app starts
def load_models():
    api_key = os.environ.get("GROQ_API_KEY")
    url = "https://api.groq.com/openai/v1/models"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return response.json()
    else:
        return {"error": "Failed to retrieve models"}

# Global variable to store the list of models
models = load_models()

# Set the default model ID to the first LLaMA model
default_model_id = next((model["id"] for model in models["data"] if "llama" in model["id"].lower()), None)


# Define the model ID as a global variable
model_id = default_model_id

# Function to retrieve the list of available models
@app.route('/api/models', methods=['GET'])
def get_models():
    return jsonify(models)
    
# Function to retrieve the current model ID
@app.route('/api/model', methods=['GET'])
def get_current_model():
    return jsonify({'modelId': model_id})

# Function to update the model ID
@app.route('/api/model', methods=['PATCH'])
def update_model():
    global model_id
    new_model_id = request.json.get('modelId')
    if new_model_id:
        # Check if the new model ID is in the list of available models
        if new_model_id in [model["id"] for model in models["data"]]:
            model_id = new_model_id
            return jsonify({'message': 'Model updated successfully'})
        else:
            return jsonify({'error': 'Invalid model ID'}), 400
    else:
        return jsonify({'error': 'No model ID provided'}), 400
 
# Function to expose the chat list to the frontend
@app.route('/api/chat-list', methods=['GET'])
def get_chat_list():
    chat_list = [{'id': id, 'name': chat['name'], 'summary': chat['summary']} for id, chat in chat_history.items()]
    return Response(json.dumps(chat_list[::-1], indent=4), mimetype='application/json')

# Function to expose an individual chat to the frontend
@app.route('/api/chat/<id>', methods=['GET'])
def get_chat(id):
    if id in chat_history:
        return Response(json.dumps(chat_history[id], indent=4), mimetype='application/json')
    else:
        return jsonify({'error': 'Chat not found'}), 404

# Function to update an individual chat
@app.route('/api/chat/<id>', methods=['PATCH'])
def update_chat(id):
    if id in chat_history:
        new_name = request.json.get('name')
        if new_name:
            chat_history[id]['name'] = new_name
            with open('chat_history.json', 'w') as f:
                json.dump(chat_history, f, indent=4)
            return jsonify({'message': 'Chat updated successfully'}), 200
        else:
            return jsonify({'error': 'No name provided'}), 400
    else:
        return jsonify({'error': 'Chat not found'}), 404

# Function to update an individual chat message
@app.route('/api/chat/<id>/message', methods=['PATCH'])
def update_chat_message(id):
    if id in chat_history:
        new_message = request.json.get('message')
        additional_content = request.json.get('additionalContent')
        if new_message:
            chat_history[id]['messages'].append({
                'sender': 'User',
                'additional_content': additional_content,
                'message': new_message,  # Use the actual message content
                'timestamp': datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
            })
            with open('chat_history.json', 'w') as f:
                json.dump(chat_history, f, indent=4)

            # Remove all system messages
            chat_history[id]['messages'] = [message for message in chat_history[id]['messages'] if message['sender'] != 'System']

            # Create a list of messages to send to the Groq API
            messages = initial_message + [
                {
                    "role": "user",
                    "content": message['message'] + ("\n" + "\n".join([f"{filename}: {content}" for filename, content in message.get('additional_content', {}).items()]) if isinstance(message.get('additional_content'), dict) else "")
                } for message in chat_history[id]['messages']
            ]
            try:
                def event_stream():
                    yield json.dumps({'message': 'Waiting for AI response...', 'reload': True})
                    chat_history[id]['messages'].append({
                        'sender': 'System',
                        'message': 'Waiting for AI response...',
                        'timestamp': datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
                    })

                    try:
                        chat_completion = client.chat.completions.create(
                            messages=messages,
                            model=model_id,
                            temperature=0,
                            max_tokens=4096,
                            stream=True
                        )
                    except Exception as e:
                        chat_history[id]['messages'].append({
                            'sender': 'System',
                            'message': str(e),
                            'timestamp': datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
                        })
                        yield json.dumps({'message': 'Chat updated unsuccessfully', 'reload': True})
                        return

                    # Remove system messages that are waiting for AI response
                    chat_history[id]['messages'] = [message for message in chat_history[id]['messages'] if not (message['sender'] == 'System' and message['message'] == 'Waiting for AI response...')]

                    for chunk in chat_completion:
                        for choice in chunk.choices:
                            if choice.delta.content:
                                if chat_history[id]['messages'] and chat_history[id]['messages'][-1]['sender'] == 'AI':
                                    chat_history[id]['messages'][-1]['message'] += choice.delta.content
                                else:
                                    chat_history[id]['messages'].append({
                                        'sender': 'AI',
                                        'message': choice.delta.content,
                                        'timestamp': datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
                                    })
                                yield json.dumps({'message': 'Chat updated successfully', 'reload': True})
                    with open('chat_history.json', 'w') as f:
                        json.dump(chat_history, f, indent=4)
                    if len(chat_history[id]['messages']) == 2:
                        chat_name, chat_summary = generate_chat_name_and_summary(chat_history[id]['messages'])           
                        if chat_name is None:
                            chat_name = f"Chat {id}"
                        if chat_summary is None:
                            chat_summary = ""
                        chat_history[id]['name'] = chat_name
                        chat_history[id]['summary'] = chat_summary
                    with open('chat_history.json', 'w') as f:
                        json.dump(chat_history, f, indent=4)
                    yield json.dumps({'message': 'Chat updated successfully final yield', 'reload': True})

                return Response(event_stream(), mimetype='text/event-stream')
            except Exception as e:
                return jsonify({'error': 'Error creating chat completion'}), 500
        else:
            return jsonify({'error': 'No message provided'}), 400
    else:
        return jsonify({'error': 'Chat not found'}), 404
# Function to stream chat messages
@app.route('/api/chat/<id>/stream', methods=['GET'])
def stream_chat_message(id):
    if id in chat_history:
        def event_stream():
            response = ''
            for chunk in chat_completion:
                for choice in chunk.choices:
                    if choice.delta.content:
                        response += choice.delta.content
                        yield f"data: {json.dumps({'message': 'Chat updated successfully', 'reload': True})}\n\n"
                        # Simulate some delay
                        import time
                        time.sleep(1)
            yield f"data: {json.dumps({'message': 'Chat updated successfully', 'reload': True})}\n\n"
            # Close the connection
            yield 'event: close\n\n'

        chat_completion = client.chat.completions.create(
            messages=initial_message,
            model=model_id,
            temperature=0,
            max_tokens=4096,
            stream=True
        )
        return Response(event_stream(), mimetype='text/event-stream')
    else:
        return jsonify({'error': 'Chat not found'}), 404

# Function to delete an individual chat
@app.route('/api/chat/<id>', methods=['DELETE'])
def delete_chat(id):
    try:
        if id in chat_history:
            del chat_history[id]
            with open('chat_history.json', 'w') as f:
                json.dump(chat_history, f, indent=4)
            return jsonify({'message': 'Chat deleted successfully'}), 200
        else:
            return jsonify({'error': 'Chat not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Function to create a new chat
@app.route('/api/chat', methods=['POST'])
def create_chat():
    if not chat_history:
        new_chat_id = "1"
    else:
        new_chat_id = str(max(map(int, chat_history.keys())) + 1)
    new_chat = {
        'name': f'Chat {new_chat_id}',
        'summary': 'Waiting for AI naming tool',
        'messages': []
    }
    chat_history[new_chat_id] = new_chat
    with open('chat_history.json', 'w') as f:
        json.dump(chat_history, f, indent=4)
    return jsonify({'message': 'Chat created successfully', 'id': new_chat_id}), 201

# Function to rename a chat with deterministic AI
@app.route('/api/chat/<id>/rename-with-ai', methods=['PATCH'])
def renameChatWithAI(id):
    if id in chat_history:
        # Generate a new name using deterministic AI
        chat_name, chat_summary = generate_chat_name_and_summary(chat_history[id]['messages'])
        chat_history[id]['name'] = chat_name
        chat_history[id]['summary'] = chat_summary
        with open('chat_history.json', 'w') as f:
            json.dump(chat_history, f, indent=4)
        return jsonify({'message': 'Chat renamed successfully'}), 200
    else:
        return jsonify({'error': 'Chat not found'}), 404
        
def open_browser():
    time.sleep(1)  # Wait for the server to start
    # Get the absolute path of index.html
    index_path = os.path.abspath('index.html')
    # Open the default browser with index.html and port number as a query parameter
    webbrowser.open(f'file://{index_path}?port={PORT}')

# Start the browser in a separate thread
thread = threading.Thread(target=open_browser)
thread.start()

if __name__ == '__main__':
    app.run(port=PORT)
