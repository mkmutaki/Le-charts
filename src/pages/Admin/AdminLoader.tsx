
export const AdminLoader = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="p-6 rounded-lg max-w-md text-center">
        <h2 className="text-xl font-semibold mb-2">Verifying access...</h2>
        <div className="mt-4 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    </div>
  );
};
