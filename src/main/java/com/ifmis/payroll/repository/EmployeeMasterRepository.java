package com.ifmis.payroll.repository;

import com.ifmis.payroll.entity.EmployeePersonalInformation;
import jakarta.persistence.Id;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EmployeeMasterRepository extends JpaRepository<EmployeePersonalInformation, String> {
}
