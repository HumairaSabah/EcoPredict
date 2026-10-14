import os
from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename
import tensorflow as tf
import numpy as np
from PIL import Image

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB max

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Load the model
model = tf.keras.models.load_model('best_model.keras', compile=False)


# Typically ImageDataGenerator uses alphabetical order of directory names
CLASSES = ['cardboard', 'glass', 'metal', 'paper', 'plastic', 'trash']

def preprocess_image(image_path):
    img = Image.open(image_path)
    img = img.resize((224, 224))  # assuming standard size
    if img.mode != 'RGB':
        img = img.convert('RGB')
    img_array = np.array(img)
    img_array = img_array / 255.0  # scale pixel values
    img_array = np.expand_dims(img_array, axis=0) # Add batch dimension
    return img_array

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        try:
            processed_img = preprocess_image(filepath)
            predictions = model.predict(processed_img)[0]
            
            # Find the top prediction
            top_index = np.argmax(predictions)
            top_class = CLASSES[top_index]
            top_prob = float(predictions[top_index])
            
            # Clean up the file
            os.remove(filepath)
            
            explanations = {
                'cardboard': [
                    "<b>Characteristics:</b> Lightweight, thick paper-based, easily foldable.",
                    "<b>Uses:</b> Packaging, shipping boxes.",
                    "<b>Biodegradable:</b> ✅ Yes",
                    "<b>Recyclable:</b> ✅ Yes"
                ],
                'glass': [
                    "<b>Characteristics:</b> Transparent, brittle, non-reactive.",
                    "<b>Uses:</b> Bottles, jars, windows.",
                    "<b>Biodegradable:</b> ❌ No",
                    "<b>Recyclable:</b> ✅ Yes (100% recyclable)"
                ],
                'metal': [
                    "<b>Characteristics:</b> Strong, durable, and corrosion-resistant (especially aluminum).",
                    "<b>Uses:</b> Cans, construction materials, machinery.",
                    "<b>Biodegradable:</b> ❌ No",
                    "<b>Recyclable:</b> ✅ Yes (highly recyclable)"
                ],
                'paper': [
                    "<b>Characteristics:</b> Thin, flexible, made from wood pulp.",
                    "<b>Uses:</b> Books, newspapers, printing.",
                    "<b>Biodegradable:</b> ✅ Yes",
                    "<b>Recyclable:</b> ✅ Yes"
                ],
                'plastic': [
                    "<b>Characteristics:</b> Lightweight, flexible, water-resistant.",
                    "<b>Uses:</b> Packaging, bottles, bags, containers.",
                    "<b>Biodegradable:</b> ❌ No (most plastics)",
                    "<b>Recyclable:</b> ⚠️ Partially (depends on type)"
                ],
                'trash': [
                    "<b>Characteristics:</b> Mixed, non-segregated waste (often dirty or contaminated materials).",
                    "<b>Uses:</b> No direct use; usually sent to landfills or incineration.",
                    "<b>Biodegradable:</b> ⚠️ Partially (depends on what’s inside)",
                    "<b>Recyclable:</b> ❌ No (not unless properly segregated)"
                ]
            }

            next_steps = {
                'cardboard': [
                    "Fold or flatten boxes",
                    "Keep dry (wet cardboard is not recyclable)",
                    "Remove plastic tapes or staples if possible",
                    "Put in dry waste or recycling bin"
                ],
                'glass': [
                    "Rinse to remove residue",
                    "Do not mix broken glass with recyclables",
                    "Separate by color if required",
                    "Place in glass recycling bin"
                ],
                'metal': [
                    "Rinse cans to remove food",
                    "Crush to save space",
                    "Avoid mixing with hazardous waste",
                    "Put in metal recycling bin"
                ],
                'paper': [
                    "Keep clean and dry",
                    "Remove food or oil contamination",
                    "Flatten before disposing",
                    "Put in paper recycling bin"
                ],
                'plastic': [
                    "Rinse to remove food/liquid",
                    "Remove non-plastic caps or labels",
                    "Check local guidelines for resin code",
                    "Put in plastic recycling bin"
                ],
                'trash': [
                    "Do not mix with recyclables",
                    "Dispose in general waste bin",
                    "Try to separate recyclable parts if possible",
                    "Reduce use of single-use items"
                ]
            }

            challenges_data = {
                'trash': {
                    'challenge': "Reduce your waste today — try to reuse at least one item instead of throwing it away!",
                    'fact': "Mixed waste often ends up in landfills and can harm the environment for years!"
                },
                'paper': {
                    'challenge': "Go paperless today — use digital notes or reuse old paper!",
                    'fact': "Recycling paper saves trees and reduces water and energy usage!"
                },
                'glass': {
                    'challenge': "Reuse a glass bottle or jar today instead of throwing it away!",
                    'fact': "Glass can be recycled endlessly without losing quality!"
                },
                'cardboard': {
                    'challenge': "Reuse a cardboard box for storage or packaging today!",
                    'fact': "Recycling cardboard reduces landfill waste and saves trees!"
                },
                'metal': {
                    'challenge': "Recycle all metal cans today instead of throwing them in general waste!",
                    'fact': "Metal can be recycled again and again without losing strength!"
                },
                'plastic': {
                    'challenge': "Avoid using single-use plastic today — carry a reusable bottle!",
                    'fact': "Plastic can take up to 450 years to decompose!"
                }
            }
            
            return jsonify({
                'success': True,
                'prediction': top_class,
                'confidence': top_prob,
                'explanation': explanations[top_class],
                'next_steps': next_steps[top_class],
                'challenge': challenges_data[top_class]['challenge'],
                'fact': challenges_data[top_class]['fact']
            })
            
        except Exception as e:
            if os.path.exists(filepath):
                os.remove(filepath)
            return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5002)
