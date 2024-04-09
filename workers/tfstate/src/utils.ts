export const getObjectKey = (email: string, projectName: string) =>
	`${email}/${projectName}.tfstate`;
