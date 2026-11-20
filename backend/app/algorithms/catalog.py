"""One metadata source for input forms, pseudocode and complexity explanations."""

GRAPH_EXAMPLE = {'nodes': ['A', 'B', 'C', 'D', 'E'], 'edges': [
    {'source': 'A', 'target': 'B', 'weight': 4}, {'source': 'A', 'target': 'C', 'weight': 1},
    {'source': 'C', 'target': 'B', 'weight': 2}, {'source': 'B', 'target': 'D', 'weight': 1},
    {'source': 'C', 'target': 'E', 'weight': 5}], 'start_node': 'A'}

STRUCTURE_CONTEXT = {
    'array': ('Constant-time indexed reads and writes.', 'Store an ordered batch of signal samples.', 'O(n) stored elements.'),
    'linked-list': ('Constant-time changes at the head without shifting later values.', 'Explore a sequence of processing tasks.', 'O(n) stored elements and links.'),
    'stack': ('Constant-time last-in, first-out operations.', 'Illustrate undo history or nested processing calls.', 'O(n) stored elements and links.'),
    'queue': ('Constant-time first-in, first-out operations.', 'Illustrate a queue of incoming signal chunks.', 'O(n) stored elements and links.'),
    'circular-queue': ('Reuses a fixed buffer without shifting elements.', 'Illustrate bounded buffering of recent samples.', 'O(capacity) reserved slots.'),
    'hash-table': ('Expected constant-time lookup with short collision chains.', 'Associate names with measurement metadata.', 'O(n + capacity) entries and buckets.'),
    'binary-tree': ('Keeps distinct keys ordered and supports sorted traversal.', 'Explore indexing of distinct measurement values.', 'O(n) stored nodes; O(h) traversal call stack.'),
    'graph': ('Represents weighted connections and directed dependencies.', 'Model connections between hypothetical processing stages.', 'O(V + E) stored nodes and adjacency entries.'),
    'priority-queue': ('Efficiently selects the smallest priority and preserves equal-priority insertion order.', 'Schedule software tasks by a numeric priority.', 'O(n) stored heap entries.'),
}


def operation(action, fields, time):
    return {'action': action, 'fields': fields.split(), 'time': time}


def structure(id, name, visual, how, time, limitations, operations, example):
    advantages, use_case, space = STRUCTURE_CONTEXT[id]
    return {'id': id, 'name': name, 'category': 'Data structures', 'visual': visual,
            'description': how, 'how': how, 'input': 'Initial values and an ordered list of operations. Graph uses named nodes and edges.',
            'output': 'State after each operation, returned values and any operation errors.',
            'time': time, 'space': space,
            'advantages': advantages, 'limitations': limitations,
            'use_case': use_case,
            'pseudocode': ['initialize the structure', 'validate the next operation',
                           'apply the operation to stored data', 'visit the next traversal node',
                           'report an operation error without changing data', 'return the final structure'],
            'operations': operations, 'example': {'algorithm': id, **example}}


CATALOG = [
    structure('array', 'Array', 'array', 'Contiguous indexed storage. Insertion and removal shift later elements.',
              'Access/set O(1); insert/remove O(n).', 'Middle insertion requires shifts.',
              [operation('insert', 'index value', 'O(n)'), operation('remove', 'index', 'O(n)'),
               operation('get', 'index', 'O(1)'), operation('set', 'index value', 'O(1)')],
              {'values': [8, 3, 5], 'operations': [{'action': 'insert', 'index': 1, 'value': 9}, {'action': 'remove', 'index': 0}]}),
    structure('linked-list', 'Linked List', 'linked-list', 'Each node links to its successor. Walk from the head to reach an index.',
              'Index/find O(n); head insert/remove O(1).', 'No constant-time random access.',
              [operation('insert', 'index value', 'O(n)'), operation('remove', 'index', 'O(n)'), operation('find', 'value', 'O(n)')],
              {'values': [2, 4, 6], 'operations': [{'action': 'insert', 'index': 1, 'value': 3}, {'action': 'find', 'value': 6}, {'action': 'remove', 'index': 0}]}),
    structure('stack', 'Stack', 'stack', 'A linked stack removes the most recently pushed value first. The head is the top.',
              'Push/pop/peek O(1).', 'Only the top is directly accessible.',
              [operation('push', 'value', 'O(1)'), operation('pop', '', 'O(1)'), operation('peek', '', 'O(1)')],
              {'values': [2, 4], 'operations': [{'action': 'push', 'value': 7}, {'action': 'peek'}, {'action': 'pop'}]}),
    structure('queue', 'Queue', 'queue', 'Head and tail links implement first-in, first-out access.',
              'Enqueue/dequeue/peek O(1).', 'Only the front is removed.',
              [operation('enqueue', 'value', 'O(1)'), operation('dequeue', '', 'O(1)'), operation('peek', '', 'O(1)')],
              {'values': [2, 4], 'operations': [{'action': 'enqueue', 'value': 7}, {'action': 'dequeue'}]}),
    structure('circular-queue', 'Circular Queue', 'circular', 'A fixed buffer wraps head and tail indices modulo capacity. Size distinguishes full from empty.',
              'Enqueue/dequeue/peek O(1).', 'Capacity is fixed. A full buffer rejects insertion.',
              [operation('enqueue', 'value', 'O(1)'), operation('dequeue', '', 'O(1)'), operation('peek', '', 'O(1)')],
              {'values': [1, 2, 3], 'capacity': 4, 'operations': [{'action': 'dequeue'}, {'action': 'enqueue', 'value': 4}, {'action': 'enqueue', 'value': 5}]}),
    structure('hash-table', 'Hash Table', 'hash', 'A deterministic polynomial string hash chooses a bucket. Separate chaining resolves collisions.',
              'Expected O(1) with short chains; worst O(n + key length).', 'Fixed bucket count can produce long chains. Initial values use their string form as keys.',
              [operation('put', 'key value', 'Expected O(1), worst O(n)'), operation('get', 'key', 'Expected O(1), worst O(n)'), operation('delete', 'key', 'Expected O(1), worst O(n)')],
              {'capacity': 4, 'operations': [{'action': 'put', 'key': 'rate', 'value': 72}, {'action': 'put', 'key': 'rr', 'value': 800}, {'action': 'get', 'key': 'rate'}]}),
    structure('binary-tree', 'Binary Tree', 'tree', 'This demonstration uses an unbalanced binary search tree with distinct keys. Smaller keys go left.',
              'Insert/find/remove O(h), worst O(n); traversal O(n).', 'Sorted insertion can form a chain. Duplicate keys are rejected.',
              [operation('insert', 'value', 'O(h)'), operation('find', 'value', 'O(h)'), operation('remove', 'value', 'O(h)'),
               operation('inorder', '', 'O(n)'), operation('preorder', '', 'O(n)'), operation('postorder', '', 'O(n)')],
              {'values': [8, 3, 10, 1, 6], 'operations': [{'action': 'insert', 'value': 9}, {'action': 'inorder'}]}),
    structure('graph', 'Graph', 'graph', 'An adjacency map stores directed or undirected weighted connections between named nodes.',
              'Add node/edge expected O(1); remove node O(V + E).', 'One edge per ordered pair. Adding an existing edge updates its weight.',
              [operation('add_node', 'node', 'Expected O(1)'), operation('add_edge', 'source target weight', 'Expected O(1)'),
               operation('remove_node', 'node', 'O(V + E)'), operation('remove_edge', 'source target', 'Expected O(1)')],
              {**GRAPH_EXAMPLE, 'operations': [{'action': 'add_node', 'node': 'F'}, {'action': 'add_edge', 'source': 'E', 'target': 'F', 'weight': 2}]}),
    structure('priority-queue', 'Priority Queue', 'priority', 'A stable binary min-heap places the smallest priority at the root. Equal priorities preserve insertion order.',
              'Push/pop O(log n); peek O(1); initialization O(n log n).', 'Heap order is partial. Initial values also serve as priorities.',
              [operation('push', 'value priority', 'O(log n)'), operation('pop', '', 'O(log n)'), operation('peek', '', 'O(1)')],
              {'values': [7, 3, 5], 'operations': [{'action': 'push', 'value': 9, 'priority': 1}, {'action': 'pop'}]}),
]


def algorithm(id, name, category, visual, description, how, time, space, advantages, limitations, use_case, pseudocode, example):
    return {'id': id, 'name': name, 'category': category, 'visual': visual,
            'description': description, 'how': how, 'time': time, 'space': space,
            'input': {'bars': 'A bounded integer array.', 'search': 'An ascending integer array and an integer target.',
                      'window': 'An integer array and a positive fixed window width.',
                      'graph': 'Unique named nodes, weighted edges, a direction flag and an optional start node.'}[visual],
            'output': {'bubble-sort': 'Sorted array.', 'merge-sort': 'Sorted array.', 'binary-search': 'Matching index or null.',
                       'sliding-window': 'Window sums and the first maximum-sum window.'}.get(id, 'Visit order or shortest distances and paths from the start node.'),
            'advantages': advantages, 'limitations': limitations, 'use_case': use_case,
            'pseudocode': pseudocode, 'operations': [], 'example': {'algorithm': id, **example}}


CATALOG += [
    algorithm('bubble-sort', 'Bubble Sort', 'Sorting', 'bars', 'Repeatedly compare adjacent values and swap inversions.',
              'Each pass places a largest remaining value at the end. Stop early when a pass makes no swaps.',
              'Best O(n), average/worst O(n²)', 'O(1) auxiliary', 'Simple, stable and in place.', 'Slow on large arrays.',
              'Compare the cost of arranging a small collection of signal measurements.',
              ['for each shrinking unsorted suffix', 'compare adjacent values', 'swap if left > right', 'mark the suffix sorted; stop if no swaps', 'return sorted values'], {'values': [8, 3, 5, 1, 6]}),
    algorithm('merge-sort', 'Merge Sort', 'Sorting', 'bars', 'Divide an array into halves, sort them and merge them.',
              'Recursively split ranges. Compare the two sorted halves, then write their merged values back.',
              'O(n log n)', 'O(n) auxiliary', 'Stable, predictable asymptotic time.', 'Uses temporary storage.',
              'Order a batch of measurements for later statistical processing.',
              ['split a nontrivial range', 'compare the next values of both halves', 'append the smaller value; keep ties left-first', 'write the merged range back', 'return sorted values'], {'values': [8, 3, 5, 1, 6]}),
    algorithm('binary-search', 'Binary Search', 'Searching', 'search', 'Find a target in an already sorted array.',
              'Compare the midpoint and discard the half that cannot contain the target.',
              'O(log n) comparisons', 'O(1) auxiliary', 'Examines few elements.', 'Input must be sorted. Any matching duplicate index may be returned.',
              'Locate a timestamp in an ordered recording index.',
              ['initialize low and high', 'compare the midpoint with target', 'return midpoint if equal', 'discard the impossible half', 'return no match when range is empty'], {'values': [1, 3, 5, 8, 12], 'target': 8}),
    algorithm('bfs', 'Breadth-First Search', 'Graphs', 'graph', 'Visit reachable graph nodes level by level.',
              'Mark nodes when enqueuing them. A FIFO queue expands each discovered node once.',
              'O(V + E)', 'O(V) auxiliary', 'Finds minimum edge-count routes in an unweighted graph.', 'Edge weights are ignored. Only the start component is visited.',
              'Explore connectivity in an educational network model.',
              ['enqueue start and mark discovered', 'dequeue the next node', 'inspect each neighbor', 'mark and enqueue each new neighbor', 'return visit order'], GRAPH_EXAMPLE),
    algorithm('dfs', 'Depth-First Search', 'Graphs', 'graph', 'Explore a branch fully before backtracking.',
              'Recursive calls follow adjacency insertion order and mark nodes before exploring neighbors.',
              'O(V + E)', 'O(V) auxiliary', 'Exposes graph structure and reachable components.', 'Traversal does not guarantee shortest paths. Weights are ignored.',
              'Walk dependencies in a small processing pipeline.',
              ['visit the start node', 'mark the current node', 'inspect each neighbor', 'recursively visit an undiscovered neighbor', 'backtrack and return visit order'], GRAPH_EXAMPLE),
    algorithm('dijkstra', "Dijkstra's Shortest Path", 'Graphs', 'graph', 'Find shortest paths with nonnegative edge weights.',
              'A min-heap selects tentative distances. Relax edges and ignore stale heap entries.',
              'O((V + E) log(V + E)) with this lazy heap', 'O(V + E) auxiliary', 'Computes distances and reconstructible paths.', 'Negative weights are rejected. Unreachable distances are null.',
              'Compare costs along a hypothetical network of processing stages.',
              ['distance[start] = 0; push start', 'pop minimum; skip stale entries, otherwise settle node', 'inspect each outgoing edge', 'relax a shorter route and push it', 'return distances and paths when heap is empty'], GRAPH_EXAMPLE),
    algorithm('sliding-window', 'Sliding Window', 'Window algorithms', 'window', 'Find a maximum-sum contiguous window of fixed width.',
              'Build the first window. Subtract the outgoing value and add the incoming value as the window moves.',
              'O(n)', 'O(1) working memory; O(n) returned sums', 'Reuses the preceding sum.', 'Window width must fit a nonempty array. This is a sum demonstration.',
              'Illustrate rolling aggregation over signal samples, separate from the ECG processing service.',
              ['sum the first k values', 'record the current window', 'subtract outgoing value and add incoming value', 'update the best window if its sum is larger', 'return window sums and first best window'], {'values': [2, 1, 5, 1, 3, 2], 'window_size': 3}),
]
BY_ID = {item['id']: item for item in CATALOG}
