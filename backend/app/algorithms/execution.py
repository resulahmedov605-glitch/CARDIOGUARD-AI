"""Run bounded, deterministic algorithms and record their actual state changes."""

from copy import deepcopy
import math

from app.dataset import ECGError
from .catalog import BY_ID
from .schemas import Execution, LabRequest, Run, Step
from .structures import Array, BinaryTree, CircularQueue, Graph, HashTable, HeapEntry, LinkedList, PriorityQueue, Queue, Stack


class Trace:
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.steps = []
        self.metrics = {'comparisons': 0, 'swaps': 0, 'writes': 0, 'operations': 0}

    def add(self, line, message, state, **fields):
        if len(self.steps) >= 4096:
            raise ValueError('Execution trace exceeds the supported size')
        self.steps.append(Step.model_validate(deepcopy({'line': line, 'message': message, 'state': state, **fields})))

    def finish(self, result):
        return Run(algorithm=self.algorithm, steps=self.steps, result=result, metrics=self.metrics)


def make_graph(request):
    if len(set(request.nodes)) != len(request.nodes):
        raise ValueError('Graph node names must be unique')
    graph = Graph(request.nodes, request.directed)
    seen = set()
    for edge in request.edges:
        pair = (edge.source, edge.target) if request.directed else frozenset((edge.source, edge.target))
        if pair in seen:
            raise ValueError('Duplicate graph edges are not supported')
        seen.add(pair)
        graph.add_edge(edge.source, edge.target, edge.weight)
    return graph


def sort_values(request):
    values = request.values.copy()
    trace = Trace(request.algorithm)
    trace.add(1, 'Initial unsorted values', {'values': values})
    if request.algorithm == 'bubble-sort':
        completed = []
        for end in range(len(values) - 1, 0, -1):
            changed = False
            for index in range(end):
                trace.metrics['comparisons'] += 1
                trace.add(2, f'Compare indices {index} and {index + 1}', {'values': values}, active=[index, index + 1], completed=completed)
                if values[index] > values[index + 1]:
                    values[index], values[index + 1] = values[index + 1], values[index]
                    changed = True
                    trace.metrics['swaps'] += 1
                    trace.metrics['writes'] += 2
                    trace.add(3, 'Swap the inverted pair', {'values': values}, active=[index, index + 1], completed=completed)
            completed.append(end)
            trace.add(4, f'Index {end} is in its final position', {'values': values}, completed=completed)
            if not changed:
                break
    else:
        def merge(left, right):
            if right - left < 2:
                return
            middle = (left + right) // 2
            trace.add(1, f'Split range [{left}, {right}) at {middle}', {'values': values}, range=[left, right - 1])
            merge(left, middle)
            merge(middle, right)
            a, b, merged = left, middle, []
            while a < middle and b < right:
                trace.metrics['comparisons'] += 1
                trace.add(2, f'Compare indices {a} and {b}', {'values': values}, active=[a, b], range=[left, right - 1])
                if values[a] <= values[b]:
                    merged.append(values[a])
                    a += 1
                else:
                    merged.append(values[b])
                    b += 1
                trace.add(3, f'Append {merged[-1]} to the merge buffer', {'values': values}, range=[left, right - 1])
            merged.extend(values[a:middle])
            merged.extend(values[b:right])
            for offset, value in enumerate(merged):
                values[left + offset] = value
                trace.metrics['writes'] += 1
                trace.add(4, f'Write {value} at index {left + offset}', {'values': values}, active=[left + offset], range=[left, right - 1])
        merge(0, len(values))
    trace.add(5, 'Sorting complete', {'values': values}, completed=list(range(len(values))))
    return trace.finish({'values': values})


def binary_search(request):
    values = request.values
    if request.target is None:
        raise ValueError('Binary search requires a target')
    if any(a > b for a, b in zip(values, values[1:])):
        raise ValueError('Binary search requires values sorted in ascending order')
    trace = Trace(request.algorithm)
    low, high, found = 0, len(values) - 1, None
    trace.add(1, 'Initialize the search interval', {'values': values}, range=[low, high])
    while low <= high:
        middle = low + (high - low) // 2
        trace.metrics['comparisons'] += 1
        trace.add(2, f'Compare {values[middle]} at index {middle} with target {request.target}', {'values': values}, active=[middle], range=[low, high])
        if values[middle] == request.target:
            found = middle
            trace.add(3, f'Found the target at index {middle}', {'values': values}, active=[middle], completed=[middle], range=[low, high])
            break
        if values[middle] < request.target:
            low = middle + 1
        else:
            high = middle - 1
        trace.add(4, f'Keep range [{low}, {high}]', {'values': values}, range=[low, high])
    if found is None:
        trace.add(5, 'The search range is empty. No match.', {'values': values}, range=[low, high])
    return trace.finish({'index': found, 'target': request.target})


def sliding_window(request):
    values, width = request.values, request.window_size
    if values and width > len(values):
        raise ValueError('Window size must fit the input array')
    trace = Trace(request.algorithm)
    trace.add(1, 'Initialize the fixed-width window', {'values': values})
    sums, best_start, best_sum = [], None, None
    current = sum(values[:width])
    for start in range(len(values) - width + 1):
        if start:
            current += values[start + width - 1] - values[start - 1]
            trace.metrics['operations'] += 2
            trace.add(3, f'Remove {values[start - 1]} and add {values[start + width - 1]}', {'values': values}, active=[start - 1, start + width - 1], range=[start, start + width - 1])
        sums.append(current)
        trace.add(2, f'Window [{start}, {start + width}) has sum {current}', {'values': values}, range=[start, start + width - 1])
        if best_sum is None or current > best_sum:
            best_sum, best_start = current, start
            trace.add(4, f'The first best window now starts at {start}', {'values': values}, range=[start, start + width - 1])
    trace.add(5, 'Window aggregation complete', {'values': values})
    return trace.finish({'sums': sums, 'max_sum': best_sum, 'start': best_start,
                         'end_exclusive': None if best_start is None else best_start + width})


def graph_algorithm(request):
    graph = make_graph(request)
    if request.start_node is not None and request.start_node not in graph.adjacency:
        raise ValueError('Start node must exist in the graph')
    if request.algorithm == 'dijkstra' and any(edge.weight < 0 for edge in request.edges):
        raise ValueError('Dijkstra requires nonnegative edge weights')
    trace = Trace(request.algorithm)
    state = graph.snapshot()
    start = request.start_node or next(iter(graph.adjacency), None)
    order, discovered = [], set()
    if start is None:
        trace.add(5, 'The graph is empty', state)
        return trace.finish({'order': [], 'distances': {}, 'paths': {}})
    if request.algorithm == 'bfs':
        queue = Queue([start])
        discovered.add(start)
        trace.add(1, f'Enqueue start {start}', state, frontier=[start])
        while queue.size:
            node = queue.dequeue()
            order.append(node)
            trace.add(2, f'Dequeue and visit {node}', state, current=node, visited=order, frontier=queue.snapshot()['values'])
            for neighbor in graph.adjacency[node]:
                trace.metrics['operations'] += 1
                trace.add(3, f'Inspect {node} → {neighbor}', state, current=node, visited=order, frontier=queue.snapshot()['values'])
                if neighbor not in discovered:
                    discovered.add(neighbor)
                    queue.enqueue(neighbor)
                    trace.add(4, f'Discover and enqueue {neighbor}', state, current=neighbor, visited=order, frontier=queue.snapshot()['values'])
    elif request.algorithm == 'dfs':
        stack = []
        def visit(node):
            discovered.add(node)
            order.append(node)
            stack.append(node)
            trace.add(2, f'Visit {node}', state, current=node, visited=order, frontier=stack)
            for neighbor in graph.adjacency[node]:
                trace.metrics['operations'] += 1
                trace.add(3, f'Inspect {node} → {neighbor}', state, current=node, visited=order, frontier=stack)
                if neighbor not in discovered:
                    trace.add(4, f'Descend to {neighbor}', state, current=neighbor, visited=order, frontier=stack)
                    visit(neighbor)
            stack.pop()
            trace.add(5, f'Backtrack from {node}', state, visited=order, frontier=stack)
        trace.add(1, f'Start depth-first traversal at {start}', state)
        visit(start)
    else:
        distances = {node: math.inf for node in graph.adjacency}
        parents = {}
        queue = PriorityQueue()
        distances[start] = 0
        queue.push(start, 0)
        def record(line, message, current=None):
            trace.add(line, message, state, current=current, visited=order,
                      frontier=[entry.value for entry in queue.entries],
                      distances={node: None if math.isinf(value) else value for node, value in distances.items()},
                      path_edges=[{'source': parent, 'target': child} for child, parent in parents.items()])
        record(1, f'Set distance of {start} to zero')
        while queue.entries:
            entry = queue.pop()
            node = entry.value
            if node in discovered:
                record(2, f'Discard stale entry for {node}')
                continue
            discovered.add(node)
            order.append(node)
            record(2, f'Settle {node} at distance {distances[node]}', node)
            for neighbor, weight in graph.adjacency[node].items():
                trace.metrics['operations'] += 1
                record(3, f'Inspect {node} → {neighbor} with weight {weight}', node)
                candidate = distances[node] + weight
                if neighbor not in discovered and candidate < distances[neighbor]:
                    distances[neighbor], parents[neighbor] = candidate, node
                    queue.push(neighbor, candidate)
                    record(4, f'Improve {neighbor} to distance {candidate}', neighbor)
        record(5, 'Shortest paths complete. Null distances are unreachable.')
        paths = {}
        for node in graph.adjacency:
            path, current = [], node
            if not math.isinf(distances[node]):
                while current is not None:
                    path.append(current)
                    current = parents.get(current)
            paths[node] = path[::-1]
        return trace.finish({'order': order, 'distances': trace.steps[-1].distances, 'paths': paths})
    trace.add(5, 'Traversal complete', state, visited=order)
    return trace.finish({'order': order})


def structure_demo(request):
    id = request.algorithm
    constructors = {'array': Array, 'linked-list': LinkedList, 'stack': Stack, 'queue': Queue,
                    'binary-tree': BinaryTree}
    if id in constructors:
        data = constructors[id](request.values)
    elif id == 'circular-queue':
        data = CircularQueue(request.capacity, request.values)
    elif id == 'hash-table':
        data = HashTable(request.capacity)
        for value in request.values:
            data.put(str(value), value)
    elif id == 'priority-queue':
        data = PriorityQueue()
        for value in request.values:
            data.push(value, value)
    else:
        data = make_graph(request)
    definitions = {operation['action']: operation for operation in BY_ID[id]['operations']}
    for operation in request.operations:
        if operation.action not in definitions:
            raise ValueError(f'Unsupported {id} operation: {operation.action}')
        fields = definitions[operation.action]['fields']
        if any(getattr(operation, field) is None for field in fields):
            raise ValueError(f'{operation.action} requires {", ".join(fields)}')
        extra = {field for field in operation.model_fields_set - {'action', *fields}
                 if getattr(operation, field) is not None and not (field == 'weight' and operation.weight == 1)}
        if extra:
            raise ValueError(f'{operation.action} does not accept {", ".join(sorted(extra))}')
    trace = Trace(id)
    trace.add(1, 'Initial structure', data.snapshot())
    returns, errors, last_visited = [], [], []
    for index, operation in enumerate(request.operations):
        trace.metrics['operations'] += 1
        last_visited = []
        trace.add(2, f'Operation {index + 1}: {operation.action}', data.snapshot())
        try:
            if id == 'graph':
                if operation.action == 'add_node' and len(data.adjacency) >= 12:
                    raise ValueError('The visualization supports at most 12 graph nodes')
                if operation.action == 'add_edge' and len(data.snapshot()['edges']) >= 32 and operation.target not in data.adjacency.get(operation.source, {}):
                    raise ValueError('The visualization supports at most 32 graph edges')
            if operation.action in ('inorder', 'preorder', 'postorder'):
                returned = data.traverse(operation.action)
                visited = []
                for value in returned:
                    visited.append(str(value))
                    trace.add(4, f'Visit {value} in {operation.action}', data.snapshot(), current=str(value), visited=visited)
                last_visited = visited
            else:
                arguments = [getattr(operation, field) for field in definitions[operation.action]['fields']]
                returned = getattr(data, operation.action)(*arguments)
            if isinstance(returned, HeapEntry):
                returned = {'value': returned.value, 'priority': returned.priority}
            returns.append({'operation': index + 1, 'action': operation.action, 'returned': returned})
            trace.add(3, f'{operation.action} completed; returned {returned!r}', data.snapshot(), visited=last_visited)
        except (ValueError, IndexError, KeyError) as error:
            message = str(error)
            errors.append({'operation': index + 1, 'message': message})
            trace.add(5, message, data.snapshot(), error=True)
    trace.add(6, 'Operation sequence complete', data.snapshot(), visited=last_visited)
    return trace.finish({'state': data.snapshot(), 'returns': returns, 'errors': errors})


def execute_one(request):
    if request.algorithm in ('bubble-sort', 'merge-sort'):
        return sort_values(request)
    if request.algorithm == 'binary-search':
        return binary_search(request)
    if request.algorithm == 'sliding-window':
        return sliding_window(request)
    if request.algorithm in ('bfs', 'dfs', 'dijkstra'):
        return graph_algorithm(request)
    return structure_demo(request)


def execute(request: LabRequest) -> Execution:
    try:
        if request.compare and request.algorithm not in ('bubble-sort', 'merge-sort'):
            raise ValueError('Comparison is available for Bubble Sort and Merge Sort')
        runs = [execute_one(request)]
        if request.compare:
            other = 'merge-sort' if request.algorithm == 'bubble-sort' else 'bubble-sort'
            runs.append(execute_one(request.model_copy(update={'algorithm': other, 'compare': False})))
        return Execution(runs=runs, step_count=max(len(run.steps) for run in runs))
    except (ValueError, IndexError, KeyError) as error:
        raise ECGError(422, str(error)) from error
