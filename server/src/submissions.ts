// REQ-3.2.3 how many businesses and events a user has submitted, shown on their public profile.
// Those tables arrive with the Week 5 and Week 6 features, so until then there is nothing to count.
// When they exist, count both here and nothing else needs to change.
export async function countSubmissions(_userId: string): Promise<number> {
  return 0;
}
