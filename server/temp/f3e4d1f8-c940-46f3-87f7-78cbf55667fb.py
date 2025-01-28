
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
    # Indent the user's code by 4 spaces
        import numpy as np
    import matplotlib.pyplot as plt
    
    print("hello")
    
    def plot_sine_wave():
        # Generate data points
        x = np.linspace(0, 2 * np.pi, 100)
        y = np.sin(x)
    
        # Create the plot
        fig, ax = plt.subplots()
        ax.plot(x, y, label='Sine wave')
    
        # Add title and labels
        ax.set_title('Sine Wave')
        ax.set_xlabel('X-axis (radians)')
        ax.set_ylabel('Y-axis (amplitude)')
    
        # Add a legend
        ax.legend()
    
        # Save the plot to the current working directory
        plt.savefig("sine_wave.png")
    
        print("Plot saved as sine_wave.png in the current directory.")
    
    # Call the function to generate and save the plot
    plot_sine_wave()
    
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
