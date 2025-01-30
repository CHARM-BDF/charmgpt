import numpy as np
import matplotlib.pyplot as plt
import pandas as pd

# Set random seed for reproducibility
np.random.seed(42)

# Generate multiple random walks with different "personalities"
n_steps = 100
n_walks = 5

# Different "personalities" for random walks
personalities = {
    'Adventurous': {'step_size': 2.0, 'direction_change': 0.8},
    'Cautious': {'step_size': 0.5, 'direction_change': 0.3},
    'Erratic': {'step_size': 1.5, 'direction_change': 0.9},
    'Steady': {'step_size': 1.0, 'direction_change': 0.2},
    'Zigzagger': {'step_size': 1.2, 'direction_change': 0.7}
}

# Initialize data storage
all_walks = {}
data = []

# Generate walks
for name, traits in personalities.items():
    x, y = [0], [0]
    direction = np.random.uniform(0, 2*np.pi)
    
    for _ in range(n_steps):
        # Maybe change direction
        if np.random.random() < traits['direction_change']:
            direction += np.random.uniform(-np.pi/4, np.pi/4)
            
        # Take step
        step = traits['step_size'] * np.random.normal(1, 0.2)
        x.append(x[-1] + step * np.cos(direction))
        y.append(y[-1] + step * np.sin(direction))
        
        # Store data
        data.append({
            'Personality': name,
            'Step': len(x)-1,
            'X': x[-1],
            'Y': y[-1],
            'Distance': np.sqrt(x[-1]**2 + y[-1]**2)
        })
    
    all_walks[name] = (x, y)

# Create plot
plt.figure(figsize=(12, 8))
colors = plt.cm.Set3(np.linspace(0, 1, len(personalities)))

for (name, (x, y)), color in zip(all_walks.items(), colors):
    plt.plot(x, y, '-', label=name, color=color, alpha=0.7, linewidth=2)
    plt.plot(x[-1], y[-1], 'o', color=color, markersize=10)

plt.title('Random Walks with Different Personalities', fontsize=14)
plt.xlabel('X Position', fontsize=12)
plt.ylabel('Y Position', fontsize=12)
plt.grid(True, alpha=0.3)
plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
plt.tight_layout()

# Save plot
plt.savefig('random_walks.png', bbox_inches='tight', dpi=300)

# Save data
df = pd.DataFrame(data)
df.to_csv('random_walks.csv', index=False)

print("Final distances from start:")
for name in personalities:
    final_distance = df[df['Personality'] == name].iloc[-1]['Distance']
    print(f"{name}: {final_distance:.2f}")
