
import sys
import json
from io import StringIO
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np

# Capture print output
output_buffer = StringIO()
sys.stdout = output_buffer

# Execute user code
try:
    # Start coding here
import pandas as pd
import numpy as np

# Your data science code goes here
print('hello')
    
    # Check if there's a plot to save
    if plt.get_fignums():
        # Convert plot to visualization data
        fig = plt.gcf()
        data = []
        for ax in fig.axes:
            for line in ax.lines:
                x_data = line.get_xdata().tolist()
                y_data = line.get_ydata().tolist()
                data.extend([{"name": str(x), "value": y} for x, y in zip(x_data, y_data)])
        
        # Save visualization data
        with open('/app/output/output.json', 'w') as f:
            json.dump(data, f)
        
    plt.close('all')
    
except Exception as e:
    print(f"Error: {str(e)}")

# Restore stdout and get output
sys.stdout = sys.__stdout__
print(output_buffer.getvalue())
