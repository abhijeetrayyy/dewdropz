import { getCustomers } from '@/actions/customers'
import CustomersClient from './CustomersClient'

// Server component: the first page arrives with the document rather than after
// it. Search and paging still fetch client-side — see useSkipMount.
export default async function CustomersPage() {
  const { customers, total } = await getCustomers({ limit: 20, offset: 0 })
  return <CustomersClient initial={{ rows: customers, total }} />
}
