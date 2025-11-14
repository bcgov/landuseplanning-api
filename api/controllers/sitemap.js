const defaultLog = require('winston').loggers.get('defaultLog');
const mongoose = require('mongoose');

/**
 * Generate a dynamic sitemap for all non-static pages
 */
exports.getDynamicSitemap = async function (req, res) {
    defaultLog.info('DYNAMIC SITEMAP GET');

    try {
        const Project = mongoose.model('Project');
        const CommentPeriod = mongoose.model('CommentPeriod');

        // Query for all projects that are publicly accessible
        const projects = await Project.find({
            read: { $in: ['public'] }
        })
            .select('_id name dateUpdated dateAdded')
            .sort({ dateUpdated: -1 })
            .lean();

        // Query for published comment periods
        const commentPeriods = await CommentPeriod.find({
            isPublished: true
        })
            .select('_id project phaseName dateUpdated dateAdded')
            .populate('project', '_id')
            .sort({ dateUpdated: -1 })
            .lean();

        // Start building the XML sitemap
        let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
        sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

        // Add each project to the sitemap
        projects.forEach(project => {
            const lastModDate = project.dateUpdated || project.dateAdded || new Date();
            const formattedDate = new Date(lastModDate).toISOString().split('T')[0];
            const baseUrl = `https://planninginpartnership.ca/p/${project._id}`;

            // Main project details page
            sitemap += `  <url>\n`;
            sitemap += `    <loc>${baseUrl}/project-details</loc>\n`;
            sitemap += `    <lastmod>${formattedDate}</lastmod>\n`;
            sitemap += `    <changefreq>weekly</changefreq>\n`;
            sitemap += `    <priority>0.8</priority>\n`;
            sitemap += `  </url>\n`;

            // Project tab pages
            const projectTabs = [
                { path: 'background-info', priority: '0.7' },
                { path: 'commenting', priority: '0.75' },
                { path: 'documents', priority: '0.75' },
                { path: 'project-phase', priority: '0.7' }
            ];

            projectTabs.forEach(tab => {
                sitemap += `  <url>\n`;
                sitemap += `    <loc>${baseUrl}/${tab.path}</loc>\n`;
                sitemap += `    <lastmod>${formattedDate}</lastmod>\n`;
                sitemap += `    <changefreq>weekly</changefreq>\n`;
                sitemap += `    <priority>${tab.priority}</priority>\n`;
                sitemap += `  </url>\n`;
            });
        });

        // Add comment periods to the sitemap
        commentPeriods.forEach(commentPeriod => {
            if (commentPeriod.project && commentPeriod.project._id) {
                const lastModDate = commentPeriod.dateUpdated || commentPeriod.dateAdded || new Date();
                const formattedDate = new Date(lastModDate).toISOString().split('T')[0];

                sitemap += `  <url>\n`;
                sitemap += `    <loc>https://planninginpartnership.ca/p/${commentPeriod.project._id}/cp/${commentPeriod._id}</loc>\n`;
                sitemap += `    <lastmod>${formattedDate}</lastmod>\n`;
                sitemap += `    <changefreq>weekly</changefreq>\n`;
                sitemap += `    <priority>0.7</priority>\n`;
                sitemap += `  </url>\n`;
            }
        });

        sitemap += '</urlset>';

        // Set the appropriate headers and send the response
        res.header('Content-Type', 'application/xml');
        res.status(200).send(sitemap);

        defaultLog.info(`Generated dynamic sitemap with ${projects.length} projects and ${commentPeriods.length} comment periods`);
    } catch (error) {
        defaultLog.error('Error generating dynamic sitemap:', error);
        res.status(500).send('<?xml version="1.0" encoding="UTF-8"?>\n<error>Failed to generate sitemap</error>');
    }
};
