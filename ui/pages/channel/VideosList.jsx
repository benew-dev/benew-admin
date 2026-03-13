import React from 'react';

const VideosList = () => {
  return (
    <div className={styles.applicationsContainer}>
      {/* Header avec recherche et filtres */}
      <div className={styles.top}>
        <AppSearch
          placeholder="Search for an application..."
          onFilterChange={handleFilterChange}
          currentFilters={currentFilters}
        />
        <AppFilters
          onFilterChange={handleFilterChange}
          currentFilters={currentFilters}
        />
        <button
          onClick={() => handleNavigate('/dashboard/applications/add', null)}
          className={styles.addButton}
          type="button"
        >
          <MdAdd /> Add Application
        </button>
      </div>
    </div>
  );
};

export default VideosList;
