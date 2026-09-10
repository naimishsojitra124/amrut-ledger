import { format, formatDistanceToNow } from "date-fns";


// Output: 10-06-2026
export const formatDate = (
  date: Date | string,
  dateFormat = "dd-MM-yyyy"
) => {
  return format(new Date(date), dateFormat);
};


// Output: 10-06-2026, 09:15 AM
export const formatDateTime = (
  date: Date | string
) => {
  return format(
    new Date(date),
    "dd-MM-yyyy, hh:mm a"
  );
};



// Output: 5 minutes ago, 5 hours ago, 3 days ago, etc.
export const formatRelativeTime = (
  date: Date | string
) => {
  return formatDistanceToNow(
    new Date(date),
    {
      addSuffix: true,
    }
  );
};
