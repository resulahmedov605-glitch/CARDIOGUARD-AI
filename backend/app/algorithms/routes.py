from fastapi import APIRouter
from .catalog import CATALOG
from .execution import execute
from .schemas import AlgorithmInfo, Execution, LabRequest

router = APIRouter(prefix='/algorithms', tags=['algorithms'])


@router.get('', response_model=list[AlgorithmInfo], response_model_exclude_unset=True,
            response_model_exclude_none=True, summary='Algorithm catalog, examples and educational metadata')
def catalog():
    return CATALOG


@router.post('/execute', response_model=Execution, summary='Execute bounded algorithms and return their real execution traces')
def run_algorithm(request: LabRequest):
    return execute(request)
