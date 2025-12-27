# New Feature: Model Bias Analysis

A new visualization page "Model Bias Analysis" has been added to the web application.
It visualizes the output probabilities of the COCO Multi-label model when given a blank (black) image input.

## Data Generation

The visualization relies on `src/data/blank_probs.json`.
A placeholder file has been created with simulated data.
To generate the real data from your trained model, please run the following command in the project root:

```bash
python infer_coco_multilabel.py --blank-value 0.0 --json-out src/data/blank_probs.json
```

This will run the inference on a blank image and overwrite the JSON file with the actual model outputs.
You can also generate data for a white image:

```bash
python infer_coco_multilabel.py --blank-value 1.0 --json-out src/data/blank_probs_white.json
```

## Files Added/Modified

- `src/index.html`: Added navigation item and view section.
- `src/js/bias_view.js`: New D3.js visualization script.
- `src/data/blank_probs.json`: Data file (currently simulated).
- `infer_coco_multilabel.py`: Modified to support `--json-out`.
