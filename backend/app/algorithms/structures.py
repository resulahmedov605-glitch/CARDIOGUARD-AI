"""Original data structures. No deque, heapq, or graph/sorting library."""

from dataclasses import dataclass
import math
from typing import Generic, TypeVar

T = TypeVar('T')


class Array:
    def __init__(self, values=()):
        self.values = list(values)

    def insert(self, index, value):
        if type(index) is not int or not 0 <= index <= len(self.values):
            raise IndexError('Index is outside the array')
        self.values.append(value)
        for position in range(len(self.values) - 1, index, -1):
            self.values[position] = self.values[position - 1]
        self.values[index] = value

    def get(self, index):
        if type(index) is not int or not 0 <= index < len(self.values):
            raise IndexError('Index is outside the array')
        return self.values[index]

    def set(self, index, value):
        self.get(index)
        self.values[index] = value

    def remove(self, index):
        value = self.get(index)
        for position in range(index, len(self.values) - 1):
            self.values[position] = self.values[position + 1]
        self.values.pop()
        return value

    def snapshot(self):
        return {'values': self.values.copy()}


@dataclass
class Link(Generic[T]):
    value: T
    next: 'Link[T] | None' = None


class LinkedList:
    def __init__(self, values=()):
        self.head = None
        self.size = 0
        for value in values:
            self.insert(self.size, value)

    def node(self, index):
        if type(index) is not int or not 0 <= index < self.size:
            raise IndexError('Index is outside the linked list')
        node = self.head
        for _ in range(index):
            node = node.next
        return node

    def insert(self, index, value):
        if type(index) is not int or not 0 <= index <= self.size:
            raise IndexError('Index is outside the linked list')
        if index == 0:
            self.head = Link(value, self.head)
        else:
            previous = self.node(index - 1)
            previous.next = Link(value, previous.next)
        self.size += 1

    def remove(self, index):
        removed = self.node(index)
        if index == 0:
            self.head = removed.next
        else:
            self.node(index - 1).next = removed.next
        self.size -= 1
        return removed.value

    def find(self, value):
        index, node = 0, self.head
        while node:
            if node.value == value:
                return index
            node, index = node.next, index + 1
        return None

    def snapshot(self):
        values, node = [], self.head
        while node:
            values.append(node.value)
            node = node.next
        return {'values': values}


class Stack(Generic[T]):
    def __init__(self, values=()):
        self.head = None
        self.size = 0
        for value in values:
            self.push(value)

    def push(self, value: T):
        self.head = Link(value, self.head)
        self.size += 1

    def peek(self) -> T:
        if self.head is None:
            raise IndexError('Stack is empty')
        return self.head.value

    def pop(self) -> T:
        value = self.peek()
        self.head = self.head.next
        self.size -= 1
        return value

    def snapshot(self):
        values, node = [], self.head
        while node:
            values.append(node.value)
            node = node.next
        return {'values': values}


class Queue(Generic[T]):
    def __init__(self, values=()):
        self.head = self.tail = None
        self.size = 0
        for value in values:
            self.enqueue(value)

    def enqueue(self, value: T):
        node = Link(value)
        if self.tail is None:
            self.head = node
        else:
            self.tail.next = node
        self.tail = node
        self.size += 1

    def peek(self) -> T:
        if self.head is None:
            raise IndexError('Queue is empty')
        return self.head.value

    def dequeue(self) -> T:
        value = self.peek()
        self.head = self.head.next
        self.size -= 1
        if self.head is None:
            self.tail = None
        return value

    def snapshot(self):
        values, node = [], self.head
        while node:
            values.append(node.value)
            node = node.next
        return {'values': values}


class CircularQueue:
    def __init__(self, capacity, values=()):
        if type(capacity) is not int or capacity < 1:
            raise ValueError('Capacity must be a positive integer')
        self.slots = [None] * capacity
        self.head = self.tail = self.size = 0
        for value in values:
            self.enqueue(value)

    def enqueue(self, value):
        if self.size == len(self.slots):
            raise ValueError('Circular queue is full')
        self.slots[self.tail] = value
        self.tail = (self.tail + 1) % len(self.slots)
        self.size += 1

    def peek(self):
        if not self.size:
            raise IndexError('Circular queue is empty')
        return self.slots[self.head]

    def dequeue(self):
        value = self.peek()
        self.slots[self.head] = None
        self.head = (self.head + 1) % len(self.slots)
        self.size -= 1
        return value

    def snapshot(self):
        return {'slots': self.slots.copy(), 'head': self.head, 'tail': self.tail,
                'values': [self.slots[(self.head + i) % len(self.slots)] for i in range(self.size)]}


class HashTable:
    def __init__(self, capacity=8):
        if type(capacity) is not int or capacity < 1:
            raise ValueError('Capacity must be positive')
        self.buckets = [[] for _ in range(capacity)]

    def index(self, key):
        if not isinstance(key, str) or not key:
            raise ValueError('Hash keys must be nonempty strings')
        value = 0
        for letter in key:
            value = (value * 31 + ord(letter)) % len(self.buckets)
        return value

    def put(self, key, value):
        bucket = self.buckets[self.index(key)]
        for index, entry in enumerate(bucket):
            if entry['key'] == key:
                bucket[index] = {'key': key, 'value': value}
                return
        bucket.append({'key': key, 'value': value})

    def get(self, key):
        for entry in self.buckets[self.index(key)]:
            if entry['key'] == key:
                return entry['value']
        raise KeyError(f'Key {key!r} is absent')

    def delete(self, key):
        value = self.get(key)
        bucket = self.buckets[self.index(key)]
        for index, entry in enumerate(bucket):
            if entry['key'] == key:
                bucket.pop(index)
                return value

    def snapshot(self):
        return {'buckets': [[dict(entry) for entry in bucket] for bucket in self.buckets]}


@dataclass
class TreeNode:
    value: int
    left: 'TreeNode | None' = None
    right: 'TreeNode | None' = None


class BinaryTree:
    """Unbalanced binary search tree with distinct keys."""
    def __init__(self, values=()):
        self.root = None
        for value in values:
            self.insert(value)

    def insert(self, value):
        if self.root is None:
            self.root = TreeNode(value)
            return
        node = self.root
        while True:
            if value == node.value:
                raise ValueError('Tree keys must be distinct')
            side = 'left' if value < node.value else 'right'
            child = getattr(node, side)
            if child is None:
                setattr(node, side, TreeNode(value))
                return
            node = child

    def find(self, value):
        node = self.root
        while node:
            if node.value == value:
                return True
            node = node.left if value < node.value else node.right
        return False

    def remove(self, value):
        parent, node = None, self.root
        while node and node.value != value:
            parent = node
            node = node.left if value < node.value else node.right
        if node is None:
            raise KeyError('Tree key is absent')
        if node.left and node.right:
            successor_parent, successor = node, node.right
            while successor.left:
                successor_parent, successor = successor, successor.left
            node.value = successor.value
            parent, node = successor_parent, successor
        replacement = node.left or node.right
        if parent is None:
            self.root = replacement
        elif parent.left is node:
            parent.left = replacement
        else:
            parent.right = replacement
        return value

    def traverse(self, order='inorder'):
        if order not in ('inorder', 'preorder', 'postorder'):
            raise ValueError('Unknown traversal order')
        values = []
        def visit(node):
            if node is None:
                return
            if order == 'preorder':
                values.append(node.value)
            visit(node.left)
            if order == 'inorder':
                values.append(node.value)
            visit(node.right)
            if order == 'postorder':
                values.append(node.value)
        visit(self.root)
        return values

    def snapshot(self):
        nodes, edges = [], []
        def visit(node, depth, left, right):
            if node is None:
                return
            middle = (left + right) / 2
            nodes.append({'id': str(node.value), 'label': str(node.value), 'x': middle, 'depth': depth})
            for child in (node.left, node.right):
                if child:
                    edges.append({'source': str(node.value), 'target': str(child.value)})
            visit(node.left, depth + 1, left, middle)
            visit(node.right, depth + 1, middle, right)
        visit(self.root, 0, 0., 1.)
        return {'nodes': nodes, 'edges': edges, 'values': self.traverse(), 'directed': True}


class Graph:
    def __init__(self, nodes=(), directed=False):
        self.adjacency = {}
        self.directed = directed
        for node in nodes:
            self.add_node(node)

    def add_node(self, node):
        if not isinstance(node, str) or not node:
            raise ValueError('Graph nodes must be nonempty strings')
        if node in self.adjacency:
            raise ValueError('Node already exists')
        self.adjacency[node] = {}

    def add_edge(self, source, target, weight=1):
        if isinstance(weight, bool) or not isinstance(weight, (int, float)) or not math.isfinite(weight):
            raise ValueError('Edge weight must be a finite number')
        if source not in self.adjacency or target not in self.adjacency:
            raise ValueError('Both edge endpoints must exist')
        self.adjacency[source][target] = weight
        if not self.directed:
            self.adjacency[target][source] = weight

    def remove_edge(self, source, target):
        if source not in self.adjacency or target not in self.adjacency[source]:
            raise KeyError('Edge is absent')
        del self.adjacency[source][target]
        if not self.directed and source != target:
            del self.adjacency[target][source]

    def remove_node(self, node):
        if node not in self.adjacency:
            raise KeyError('Node is absent')
        del self.adjacency[node]
        for neighbors in self.adjacency.values():
            neighbors.pop(node, None)

    def snapshot(self):
        edges, seen = [], set()
        for source, neighbors in self.adjacency.items():
            for target, weight in neighbors.items():
                pair = (source, target) if self.directed else frozenset((source, target))
                if pair not in seen:
                    edges.append({'source': source, 'target': target, 'weight': weight})
                    seen.add(pair)
        return {'nodes': [{'id': node, 'label': node} for node in self.adjacency],
                'edges': edges, 'directed': self.directed}


@dataclass
class HeapEntry(Generic[T]):
    value: T
    priority: float
    sequence: int


class PriorityQueue(Generic[T]):
    """Stable min-heap. Equal priorities preserve insertion order."""
    def __init__(self):
        self.entries = []
        self.sequence = 0

    def _less(self, left, right):
        a, b = self.entries[left], self.entries[right]
        return (a.priority, a.sequence) < (b.priority, b.sequence)

    def push(self, value: T, priority):
        if isinstance(priority, bool) or not isinstance(priority, (int, float)) or not math.isfinite(priority):
            raise ValueError('Priority must be a finite number')
        self.entries.append(HeapEntry(value, priority, self.sequence))
        self.sequence += 1
        child = len(self.entries) - 1
        while child and self._less(child, (child - 1) // 2):
            parent = (child - 1) // 2
            self.entries[child], self.entries[parent] = self.entries[parent], self.entries[child]
            child = parent

    def peek(self) -> HeapEntry[T]:
        if not self.entries:
            raise IndexError('Priority queue is empty')
        return self.entries[0]

    def pop(self) -> HeapEntry[T]:
        first = self.peek()
        last = self.entries.pop()
        if not self.entries:
            return first
        self.entries[0] = last
        parent = 0
        while 2 * parent + 1 < len(self.entries):
            child = 2 * parent + 1
            if child + 1 < len(self.entries) and self._less(child + 1, child):
                child += 1
            if not self._less(child, parent):
                break
            self.entries[parent], self.entries[child] = self.entries[child], self.entries[parent]
            parent = child
        return first

    def snapshot(self):
        return {'values': [entry.value for entry in self.entries],
                'priorities': [entry.priority for entry in self.entries]}
