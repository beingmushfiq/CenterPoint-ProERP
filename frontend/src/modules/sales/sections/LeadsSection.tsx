import { CrmWorkspace } from '../../crm/CrmWorkspace';

/**
 * LeadsSection - Sales Module Delegate Wrapper
 *
 * Provides backward compatibility for the `/sales?tab=leads` URL route and
 * SalesWorkspace tab, delegating rendering to the modular CRM workspace.
 */
export function LeadsSection() {
  return <CrmWorkspace />;
}

export default LeadsSection;
