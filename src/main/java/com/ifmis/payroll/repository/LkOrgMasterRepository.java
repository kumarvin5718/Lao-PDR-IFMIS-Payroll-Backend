package com.ifmis.payroll.repository;

import com.ifmis.payroll.entity.master.LkOrgMaster;
import com.ifmis.payroll.entity.master.Ministry;
import com.ifmis.payroll.entity.master.Department;
import com.ifmis.payroll.entity.master.ProfessionCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface LkOrgMasterRepository extends JpaRepository<LkOrgMaster, UUID> {
    Optional<LkOrgMaster> findByMinistryAndDepartmentAndProfessionCategory(Ministry ministry, Department department, ProfessionCategory professionCategory);
}
