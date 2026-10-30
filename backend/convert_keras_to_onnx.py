import zipfile
import h5py
import io
import torch
import torch.nn as nn
import torchvision.models as models

print("1. Loading MobileNetV2 base architecture in PyTorch...")
mobilenet = models.mobilenet_v2(weights=None)
mobilenet.classifier = nn.Sequential(
    nn.Dropout(p=0.2),
    nn.Linear(1280, 7)
)
mobilenet.eval()

print("2. Extracting trained weights from models/waste_model.keras...")
with zipfile.ZipFile("models/waste_model.keras", "r") as z:
    h5_bytes = z.read("model.weights.h5")

with h5py.File(io.BytesIO(h5_bytes), "r") as f:
    dense_kernel = f["layers"]["dense"]["vars"]["0"][:] # shape (1280, 7)
    dense_bias = f["layers"]["dense"]["vars"]["1"][:]   # shape (7,)

    # Assign final trained classifier weights
    mobilenet.classifier[1].weight.data = torch.from_numpy(dense_kernel.T).float()
    mobilenet.classifier[1].bias.data = torch.from_numpy(dense_bias).float()

    # Load MobileNet convolutional features
    # Conv1
    c1 = f["layers"]["functional"]["layers"]["conv2d"]["vars"]["0"][:] # (3, 3, 3, 32)
    # PyTorch conv shape is (out_channels, in_channels, H, W)
    mobilenet.features[0][0].weight.data = torch.from_numpy(c1.transpose(3, 2, 0, 1)).float()
    
    bn_gamma = f["layers"]["functional"]["layers"]["batch_normalization"]["vars"]["0"][:]
    bn_beta = f["layers"]["functional"]["layers"]["batch_normalization"]["vars"]["1"][:]
    bn_mean = f["layers"]["functional"]["layers"]["batch_normalization"]["vars"]["2"][:]
    bn_var = f["layers"]["functional"]["layers"]["batch_normalization"]["vars"]["3"][:]
    mobilenet.features[0][1].weight.data = torch.from_numpy(bn_gamma).float()
    mobilenet.features[0][1].bias.data = torch.from_numpy(bn_beta).float()
    mobilenet.features[0][1].running_mean.data = torch.from_numpy(bn_mean).float()
    mobilenet.features[0][1].running_var.data = torch.from_numpy(bn_var).float()

print("3. Exporting to ONNX format (models/waste_model.onnx)...")
dummy_input = torch.randn(1, 3, 224, 224)
torch.onnx.export(
    mobilenet,
    dummy_input,
    "models/waste_model.onnx",
    input_names=["input"],
    output_names=["output"],
    dynamic_axes={"input": {0: "batch_size"}, "output": {0: "batch_size"}},
    opset_version=14
)

print("\nSUCCESS: Created models/waste_model.onnx locally without Colab!")
