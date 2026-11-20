import json
import random

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.algorithms.catalog import CATALOG
from app.algorithms.execution import execute
from app.algorithms.schemas import AlgorithmInfo, LabRequest
from app.algorithms.structures import Array, LinkedList, Stack, Queue, CircularQueue, HashTable, BinaryTree, Graph, PriorityQueue


def run(algorithm, **fields):
    return execute(LabRequest(algorithm=algorithm, **fields)).runs[0]


@pytest.mark.parametrize('kind', [Array, LinkedList])
def test_array_and_linked_list_insert_remove_boundaries(kind):
    structure = kind([1, 3])
    structure.insert(1, 2)
    structure.insert(0, 0)
    assert structure.snapshot()['values'] == [0, 1, 2, 3]
    assert structure.remove(3) == 3
    assert structure.remove(0) == 0
    for index in (-1, 100, True):
        with pytest.raises(IndexError):
            structure.remove(index)
    assert structure.snapshot()['values'] == [1, 2]
    if isinstance(structure, Array):
        structure.set(1, 9)
        assert structure.get(1) == 9
    else:
        assert structure.find(2) == 1
        assert structure.find(99) is None


def test_stack_and_queue_order_and_empty_recovery():
    stack, queue = Stack(), Queue()
    for value in range(5):
        stack.push(value)
        queue.enqueue(value)
    assert [stack.pop() for _ in range(5)] == [4, 3, 2, 1, 0]
    assert [queue.dequeue() for _ in range(5)] == list(range(5))
    for structure, action in ((stack, stack.pop), (queue, queue.dequeue)):
        with pytest.raises(IndexError):
            action()
        assert structure.size == 0
    queue.enqueue(9)
    assert queue.peek() == queue.dequeue() == 9
    assert queue.head is queue.tail is None


def test_circular_wraparound_full_empty_and_capacity_one():
    queue = CircularQueue(3, [1, 2, 3])
    before = queue.snapshot()
    with pytest.raises(ValueError):
        queue.enqueue(4)
    assert queue.snapshot() == before
    assert queue.dequeue() == 1
    queue.enqueue(4)
    assert queue.head == queue.tail == 1
    assert queue.snapshot()['values'] == [2, 3, 4]
    one = CircularQueue(1)
    for value in range(8):
        one.enqueue(value)
        assert one.dequeue() == value
    with pytest.raises(IndexError):
        one.dequeue()
    with pytest.raises(ValueError):
        CircularQueue(0)


def test_hash_collisions_replacement_delete_and_missing_keys():
    table = HashTable(1)
    table.put('a', 1)
    table.put('b', 2)
    table.put('a', 3)
    assert table.get('a') == 3
    assert len(table.buckets[0]) == 2
    assert table.delete('a') == 3
    assert table.get('b') == 2
    with pytest.raises(KeyError):
        table.delete('absent')
    with pytest.raises(ValueError):
        table.put('', 4)


def test_binary_tree_traversal_and_all_removal_shapes():
    tree = BinaryTree([8, 3, 10, 1, 6, 9, 12])
    assert tree.traverse('inorder') == [1, 3, 6, 8, 9, 10, 12]
    assert tree.traverse('preorder') == [8, 3, 1, 6, 10, 9, 12]
    assert tree.traverse('postorder') == [1, 6, 3, 9, 12, 10, 8]
    with pytest.raises(ValueError):
        tree.insert(8)
    for value in [8, 1, 3, 10, 9, 6, 12]:
        assert tree.find(value)
        assert tree.remove(value) == value
        assert not tree.find(value)
    assert tree.root is None
    with pytest.raises(KeyError):
        tree.remove(5)


def test_graph_directed_undirected_self_edges_and_removal():
    graph = Graph(['A', 'B'])
    graph.add_edge('A', 'B', 2)
    graph.add_edge('A', 'A', 0)
    assert len(graph.snapshot()['edges']) == 2
    graph.remove_edge('A', 'A')
    graph.remove_node('B')
    assert graph.adjacency == {'A': {}}
    directed = Graph(['A', 'B'], True)
    directed.add_edge('A', 'B')
    assert directed.adjacency['B'] == {}
    with pytest.raises(ValueError):
        directed.add_edge('A', 'Z')


def test_priority_queue_heap_order_stability_and_invalid_priorities():
    queue = PriorityQueue()
    for value, priority in [('a', 3), ('b', -1), ('c', 3), ('d', 0)]:
        queue.push(value, priority)
    assert [queue.pop().value for _ in range(4)] == ['b', 'd', 'a', 'c']
    with pytest.raises(IndexError):
        queue.pop()
    with pytest.raises(ValueError):
        queue.push('bad', float('nan'))


@pytest.mark.parametrize('algorithm', ['bubble-sort', 'merge-sort'])
@pytest.mark.parametrize('values', [[], [1], [3, 3, 1], [-9, 0, 4, -2], list(range(24, 0, -1))])
def test_sorting_matches_reference_and_initial_states_are_immutable(algorithm, values):
    result = run(algorithm, values=values)
    assert result.result['values'] == sorted(values)
    assert result.steps[0].state.values == values
    assert result.steps[-1].state.values == sorted(values)
    assert len(result.steps) < 4096
    for step in result.steps:
        assert all(0 <= index < len(values) for index in step.active)
    assert result.model_dump() == run(algorithm, values=values).model_dump()


def test_sort_randomized_and_comparison_metrics():
    generator = random.Random(42)
    for _ in range(30):
        values = [generator.randrange(-20, 21) for _ in range(generator.randrange(25))]
        for algorithm in ('bubble-sort', 'merge-sort'):
            assert run(algorithm, values=values).result['values'] == sorted(values)
    result = execute(LabRequest(algorithm='bubble-sort', values=[3, 2, 1], compare=True))
    assert len(result.runs) == 2
    assert result.runs[0].metrics['comparisons'] == result.runs[0].metrics['swaps'] == 3
    assert result.step_count == max(len(run.steps) for run in result.runs)


@pytest.mark.parametrize('values,target,index', [([], 3, None), ([1], 1, 0), ([1, 3, 8], 8, 2), ([1, 3, 8], 4, None)])
def test_binary_search(values, target, index):
    assert run('binary-search', values=values, target=target).result['index'] == index


def test_sliding_window_negative_ties_and_empty():
    assert run('sliding-window', values=[]).result['max_sum'] is None
    result = run('sliding-window', values=[-4, -2, -2], window_size=1).result
    assert result['max_sum'] == -2 and result['start'] == 1
    assert run('sliding-window', values=[2, 1, 5, 1, 3, 2], window_size=3).result['sums'] == [8, 7, 9, 6]


def test_graph_traversal_and_dijkstra_zero_weight_cycles_and_disconnected_nodes():
    graph = {'nodes': ['A', 'B', 'C', 'Z'], 'edges': [
        {'source': 'A', 'target': 'B', 'weight': 5}, {'source': 'A', 'target': 'C', 'weight': 0},
        {'source': 'C', 'target': 'B', 'weight': 1}], 'start_node': 'A'}
    assert run('bfs', **graph).result['order'] == ['A', 'B', 'C']
    assert run('dfs', **graph).result['order'] == ['A', 'B', 'C']
    result = run('dijkstra', **graph)
    assert result.result['distances'] == {'A': 0, 'B': 1, 'C': 0, 'Z': None}
    assert result.result['paths']['B'] == ['A', 'C', 'B']
    assert result.result['paths']['Z'] == []
    assert 'stale' in ' '.join(step.message for step in result.steps)
    for algorithm in ('bfs', 'dfs', 'dijkstra'):
        assert run(algorithm).result['order'] == []
        assert len(run(algorithm, nodes=['A'], start_node='A').result['order']) == 1


def test_operation_errors_are_recorded_without_corrupting_structure():
    result = run('stack', operations=[{'action': 'pop'}, {'action': 'push', 'value': 7}, {'action': 'pop'}])
    assert result.result['state']['values'] == []
    assert len(result.result['errors']) == 1
    assert result.steps[2].error and result.steps[2].state.values == []
    assert result.result['returns'][-1]['returned'] == 7


@pytest.mark.parametrize('entry', CATALOG, ids=lambda entry: entry['id'])
def test_catalog_examples_have_valid_typed_deterministic_execution(entry):
    info = AlgorithmInfo.model_validate(entry)
    first = execute(info.example)
    assert first.model_dump() == execute(info.example).model_dump()
    assert all(1 <= step.line <= len(info.pseudocode) for step in first.runs[0].steps)
    assert not first.runs[0].result.get('errors')


@pytest.mark.parametrize('body', [
    {'algorithm': 'eval'}, {'algorithm': 'bubble-sort', 'values': [True]},
    {'algorithm': 'bubble-sort', 'values': list(range(25))},
    {'algorithm': 'binary-search', 'values': [3, 1], 'target': 1},
    {'algorithm': 'binary-search'}, {'algorithm': 'sliding-window', 'values': [1], 'window_size': 2},
    {'algorithm': 'sliding-window', 'window_size': 0}, {'algorithm': 'queue', 'compare': True},
    {'algorithm': 'graph', 'nodes': ['A', 'A']},
    {'algorithm': 'bfs', 'nodes': ['A'], 'start_node': 'Z'},
    {'algorithm': 'dfs', 'nodes': ['A'], 'edges': [{'source': 'A', 'target': 'B'}]},
    {'algorithm': 'dijkstra', 'nodes': ['A', 'B'], 'edges': [{'source': 'A', 'target': 'B', 'weight': -1}]},
    {'algorithm': 'graph', 'nodes': ['A', 'B'], 'edges': [{'source': 'A', 'target': 'B'}, {'source': 'B', 'target': 'A'}]},
    {'algorithm': 'stack', 'operations': [{'action': '__class__'}]},
    {'algorithm': 'stack', 'operations': [{'action': 'push'}]},
    {'algorithm': 'stack', 'operations': [{'action': 'pop', 'value': 1}]},
    {'algorithm': 'circular-queue', 'capacity': 1, 'values': [1, 2]},
    {'algorithm': 'binary-tree', 'values': [1, 1]},
])
def test_invalid_requests_are_meaningful_422(body):
    with TestClient(create_app()) as client:
        response = client.post('/api/v1/algorithms/execute', json=body)
        assert response.status_code == 422, response.text
        assert response.json()['detail']


def test_api_catalog_run_openapi_and_nonfinite_validation():
    with TestClient(create_app()) as client:
        catalog = client.get('/api/v1/algorithms')
        assert catalog.status_code == 200 and len(catalog.json()) == 16
        for entry in catalog.json():
            response = client.post('/api/v1/algorithms/execute', json=entry['example'])
            assert response.status_code == 200, response.text
        response = client.post('/api/v1/algorithms/execute', content='{"algorithm":"graph","edges":[{"source":"A","target":"B","weight":NaN}]}', headers={'Content-Type': 'application/json'})
        assert response.status_code == 422
        assert json.loads(response.text)['detail']
        assert '/api/v1/algorithms/execute' in client.get('/openapi.json').json()['paths']
        assert client.get('/api/v1/health').status_code == 200
