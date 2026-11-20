import Ajv2020 from 'ajv/dist/2020.js';
import lifecycle from '../../contracts/project-lifecycle-context.v1.json';
import bootstrapReceipt from '../../contracts/workspace-intelligence/agent-bootstrap-receipt.v1.json';
import bootstrapView from '../../contracts/workspace-intelligence/agent-bootstrap-view.v1.json';
import taskContext from '../../contracts/workspace-intelligence/agent-task-context.v1.json';
import taskRoute from '../../contracts/workspace-intelligence/agent-task-route.v1.json';
import topology from '../../contracts/workspace-intelligence/workspace-dependency-graph.v1.json';
import graphView from '../../contracts/workspace-intelligence/workspace-graph-search-view.v1.json';
import graph from '../../contracts/workspace-intelligence/workspace-knowledge-graph.v1.json';

// Compile on first use so extension activation does not need to initialize schema validation.
let validator: Ajv2020 | undefined;

export function matchesStudioTaskRouteContract(
  value: unknown,
  contract: 'route' | 'lifecycle'
): boolean {
  validator ??= new Ajv2020({
    strict: false,
    validateFormats: false,
    schemas: [
      lifecycle,
      bootstrapReceipt,
      bootstrapView,
      taskContext,
      taskRoute,
      graphView,
      graph,
      topology,
    ],
  });
  const schema = contract === 'route' ? taskRoute : lifecycle;
  return validator.validate(schema.$id, value) === true;
}
