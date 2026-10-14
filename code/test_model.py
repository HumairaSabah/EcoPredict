import tensorflow as tf
model = tf.keras.models.load_model('best_model.keras')
print(model.summary())
print("Output shape:", model.output_shape)
